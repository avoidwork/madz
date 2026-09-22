import { describe, it } from "node:test";
import assert from "node:assert";
import { createTokenBudget } from "../../../src/provider/tokenBudget.js";

/**
 * Create a controllable clock for deterministic time-based tests.
 * @returns {{now: Function, advance: Function}} Clock control
 */
function makeClock() {
	let time = 0;
	return {
		now: () => time,
		advance: (ms) => {
			time += ms;
		},
	};
}

describe("createTokenBudget", () => {
	it("consume records tokens in the window", () => {
		const budget = createTokenBudget(100000);
		budget.consume(1000);
		assert.strictEqual(budget.current(), 1000);
	});

	it("current returns zero when window is empty", () => {
		const budget = createTokenBudget(100000);
		assert.strictEqual(budget.current(), 0);
	});

	it("current evicts entries older than 60 seconds", () => {
		const clock = makeClock();
		const budget = createTokenBudget(100000, { now: clock.now });
		budget.consume(1000);
		clock.advance(60_001);
		assert.strictEqual(budget.current(), 0);
	});

	it("current keeps entries within the 60-second window", () => {
		const clock = makeClock();
		const budget = createTokenBudget(100000, { now: clock.now });
		budget.consume(1000);
		clock.advance(59_000);
		assert.strictEqual(budget.current(), 1000);
	});

	it("disabled path does not track tokens when maxTokensMinute is 0", () => {
		const budget = createTokenBudget(0);
		budget.consume(1000);
		assert.strictEqual(budget.current(), 0);
	});

	it("disabled path resolves immediately regardless of estimatedTokens", async () => {
		const budget = createTokenBudget(0);
		await budget.waitForCapacity(1_000_000);
		assert.strictEqual(budget.current(), 0);
	});

	it("waitForCapacity resolves immediately when room is available", async () => {
		const budget = createTokenBudget(100000);
		budget.consume(1000);
		await budget.waitForCapacity(1000);
		assert.strictEqual(budget.current(), 1000);
	});

	it("waitForCapacity waits when the window is near capacity", async () => {
		const clock = makeClock();
		let slept = 0;
		const budget = createTokenBudget(100000, {
			now: clock.now,
			sleep: async (ms) => {
				slept += ms;
				clock.advance(ms);
			},
		});
		budget.consume(99_000);
		await budget.waitForCapacity(2000);
		assert.ok(slept > 0, "should have slept to wait for capacity");
	});

	it("waitForCapacity handles a request larger than the whole budget", async () => {
		const clock = makeClock();
		let slept = 0;
		const budget = createTokenBudget(100000, {
			now: clock.now,
			sleep: async (ms) => {
				slept += ms;
				clock.advance(ms);
			},
		});
		budget.consume(50_000);
		// Request of 200k exceeds the entire 100k budget; waits until window drains
		await budget.waitForCapacity(200_000);
		assert.ok(slept > 0, "should have slept to drain the window");
		assert.strictEqual(budget.current(), 0);
	});

	it("handles rapid successive requests within the budget", async () => {
		const budget = createTokenBudget(100000);
		for (let i = 0; i < 10; i++) {
			budget.consume(1000);
		}
		assert.strictEqual(budget.current(), 10_000);
	});

	it("exactly-at-limit resolves without delay", async () => {
		const clock = makeClock();
		let slept = 0;
		const budget = createTokenBudget(100000, {
			now: clock.now,
			sleep: async (ms) => {
				slept += ms;
				clock.advance(ms);
			},
		});
		budget.consume(98_000);
		await budget.waitForCapacity(2000);
		assert.strictEqual(slept, 0, "exactly at limit should not sleep");
	});

	describe("reserve", () => {
		it("records tokens and returns a handle", async () => {
			const budget = createTokenBudget(100000);
			const handle = await budget.reserve(1000);
			assert.ok(handle !== null, "should return a handle");
			assert.strictEqual(budget.current(), 1000);
		});

		it("returns null handle when disabled", async () => {
			const budget = createTokenBudget(0);
			const handle = await budget.reserve(1000);
			assert.strictEqual(handle, null);
			assert.strictEqual(budget.current(), 0);
		});

		it("concurrent reserves do not overshoot the budget", async () => {
			const clock = makeClock();
			let slept = 0;
			const budget = createTokenBudget(1000, {
				now: clock.now,
				sleep: async (ms) => {
					slept += ms;
					clock.advance(ms);
				},
			});
			// 3 concurrent reserves of 600 each; only 1 fits in a 1000 window.
			const handles = await Promise.all([
				budget.reserve(600),
				budget.reserve(600),
				budget.reserve(600),
			]);
			assert.strictEqual(handles.length, 3);
			assert.ok(handles.every((h) => h !== null));
			// The key invariant: the window never held more than one 600-token
			// entry at a time. Each of the 2nd and 3rd reserves had to wait for
			// the previous entry to expire (a full 60s window each) before being
			// admitted, so current() never exceeded maxTokensMinute.
			assert.strictEqual(slept, 120_000, "reserves must wait for the window to drain");
			// Only the most recent entry remains inside the window.
			assert.strictEqual(budget.current(), 600);
		});

		it("waits for capacity before admitting a reserve that does not fit", async () => {
			const clock = makeClock();
			let slept = 0;
			const budget = createTokenBudget(1000, {
				now: clock.now,
				sleep: async (ms) => {
					slept += ms;
					clock.advance(ms);
				},
			});
			// Fill the window to 900.
			await budget.reserve(900);
			// A second reserve of 200 does not fit (900+200 > 1000); must wait.
			// The sleep function advances the clock, evicting the first entry.
			const p = budget.reserve(200);
			await p;
			assert.ok(slept > 0, "should have slept to wait for capacity");
			assert.strictEqual(budget.current(), 200);
		});
	});

	describe("reconcile", () => {
		it("adjusts an entry up to actual usage", async () => {
			const budget = createTokenBudget(100000);
			const handle = await budget.reserve(1000);
			budget.reconcile(handle, 1500);
			assert.strictEqual(budget.current(), 1500);
		});

		it("adjusts an entry down to actual usage", async () => {
			const budget = createTokenBudget(100000);
			const handle = await budget.reserve(1000);
			budget.reconcile(handle, 400);
			assert.strictEqual(budget.current(), 400);
		});

		it("is a no-op for an unknown handle", async () => {
			const budget = createTokenBudget(100000);
			await budget.reserve(1000);
			budget.reconcile(99999, 500);
			assert.strictEqual(budget.current(), 1000);
		});
	});

	describe("release", () => {
		it("removes a reserved entry", async () => {
			const budget = createTokenBudget(100000);
			const handle = await budget.reserve(1000);
			budget.release(handle);
			assert.strictEqual(budget.current(), 0);
		});

		it("is a no-op for an unknown handle", async () => {
			const budget = createTokenBudget(100000);
			await budget.reserve(1000);
			budget.release(99999);
			assert.strictEqual(budget.current(), 1000);
		});
	});
});
