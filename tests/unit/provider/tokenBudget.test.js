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
});
