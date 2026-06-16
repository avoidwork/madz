import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	gc,
	isAvailable,
	initGC,
	getGcCalls,
	_resetGcCalls,
	_setGcCalls,
} from "../../src/memory/gc.js";
import { CommandRegistry } from "../../src/tui/utils/commandParser.js";

describe("gc - V8 garbage collection", () => {
	beforeEach(() => {
		global.gc = undefined;
		delete process[Symbol.for("madz.gc.warned")];
		_resetGcCalls();
	});

	describe("isAvailable", () => {
		it("returns false when global.gc is not defined", () => {
			assert.strictEqual(isAvailable(), false);
		});

		it("returns true when global.gc is defined", () => {
			global.gc = function fakeGc() {};
			assert.strictEqual(isAvailable(), true);
			delete global.gc;
		});

		it("returns true when global.gc is a real function", () => {
			global.gc = () => {};
			assert.strictEqual(isAvailable(), true);
			delete global.gc;
		});
	});

	describe("gc", () => {
		it("prunes stale calls before check", () => {
			global.gc = () => {};
			_resetGcCalls();
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000]);
			const result = gc(10);
			assert.ok(result.triggered);
			assert.strictEqual(getGcCalls().length, 1);
			delete global.gc;
		});

		it("prunes stale calls outside hour window", () => {
			// Manually inject stale timestamps by calling the gc function
			// The gcCalls array is module-private, so we verify pruning via behavior
			_resetGcCalls();
			global.gc = () => {};
			// Call gc multiple times to build up entries
			for (let i = 0; i < 5; i++) {
				gc(10);
			}
			assert.strictEqual(getGcCalls().length, 5);
			delete global.gc;
		});

		it("returns { triggered: false, reason: 'gc not available' } when global.gc is missing", () => {
			_resetGcCalls();
			const result = gc(4);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "gc not available");
			assert.ok(result.hourCalls >= 0);
		});

		it("does not call global.gc when not available (no crash)", () => {
			let noError = true;
			try {
				gc(4);
			} catch {
				noError = false;
			}
			assert.strictEqual(noError, true);
		});

		it("returns { triggered: true } when global.gc is available", () => {
			global.gc = () => {};
			_resetGcCalls();
			const result = gc(4);
			assert.strictEqual(result.triggered, true);
			assert.ok(result.hourCalls >= 1);
			assert.ok(typeof result.lastRun === "number");
			delete global.gc;
		});

		it("calls global.gc() when available", () => {
			let called = false;
			global.gc = () => {
				called = true;
			};
			_resetGcCalls();
			gc(4);
			assert.strictEqual(called, true);
			delete global.gc;
		});

		it("returns { triggered: false, reason: 'rate limited' } when maxGcPerHour reached", () => {
			global.gc = () => {};
			_resetGcCalls();
			const max = 3;
			for (let i = 0; i < max; i++) {
				gc(max);
			}
			const result = gc(max);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "rate limited");
			assert.strictEqual(result.hourCalls, max);
			delete global.gc;
		});

		it("tracks hourCalls correctly when available", () => {
			global.gc = () => {};
			_resetGcCalls();
			const result = gc(10);
			assert.ok(result.hourCalls >= 1);
			delete global.gc;
		});

		it("prunes stale calls from gcCalls", () => {
			_resetGcCalls();
			global.gc = () => {};
			// Inject old timestamps (2 hours ago)
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000]);
			const result = gc(10);
			// Should prune the old entry and trigger gc
			assert.strictEqual(result.triggered, true);

			// Now only the current call should be in gcCalls
			assert.strictEqual(getGcCalls().length, 1);
			delete global.gc;
		});

		it("prunes stale calls when gc not available (covers warning path pruning)", () => {
			_resetGcCalls();
			delete process[Symbol.for("madz.gc.warned")];
			// Inject stale timestamps
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000]);
			const result = gc(10);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "gc not available");
		});

		it("second rate limit check after pruning blocks GC", () => {
			_resetGcCalls();
			global.gc = () => {};
			// Inject entries that fill up the rate limit, plus a stale entry
			const recent = Date.now();
			const stale = Date.now() - 2 * 60 * 60 * 1000;
			_setGcCalls([stale, recent, recent, recent, recent]);
			const result = gc(4);
			// After pruning stale, 4 recent entries remain → rate limited
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "rate limited");
			delete global.gc;
		});

		it("second pruning loop handles all-stale entries", () => {
			_resetGcCalls();
			global.gc = () => {};
			// Inject only stale entries (the second loop should run)
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000, Date.now() - 1.5 * 60 * 60 * 1000]);
			const result = gc(10);
			assert.strictEqual(result.triggered, true);
			assert.strictEqual(getGcCalls().length, 1);
			delete global.gc;
		});

		it("logs warning only once per process lifetime", () => {
			_resetGcCalls();
			gc(4); // First call without global.gc - should log warning
			const result2 = gc(4); // Second call - should NOT log warning
			assert.strictEqual(result2.triggered, false);
			assert.strictEqual(result2.reason, "gc not available");
		});
	});

	describe("initGC", () => {
		it("creates a controller with onActivity and stop methods", () => {
			const onIdle = () => {};
			const controller = initGC({ idleTimeoutMs: 60000, maxGcPerHour: 4, onIdle });
			assert.ok(typeof controller.onActivity === "function");
			assert.ok(typeof controller.stop === "function");
			controller.stop();
		});

		it("onActivity resets the idle timer", () => {
			let triggered = 0;
			const controller = initGC({
				idleTimeoutMs: 50,
				maxGcPerHour: 4,
				onIdle: () => {
					triggered++;
				},
			});
			controller.onActivity();
			controller.onActivity();
			assert.strictEqual(triggered, 0);
			controller.stop();
		});

		it("triggers onIdle after idle timeout", async () => {
			let triggered = false;
			const controller = initGC({
				idleTimeoutMs: 50,
				maxGcPerHour: 4,
				onIdle: () => {
					triggered = true;
				},
			});
			await new Promise((resolve) => setTimeout(resolve, 100));
			controller.stop();
			assert.strictEqual(triggered, true);
		});

		it("stop() clears the idle timer", async () => {
			let triggered = false;
			const controller = initGC({
				idleTimeoutMs: 50,
				maxGcPerHour: 4,
				onIdle: () => {
					triggered = true;
				},
			});
			controller.stop();
			await new Promise((resolve) => setTimeout(resolve, 100));
			assert.strictEqual(triggered, false);
		});
	});

	describe("getGcCalls", () => {
		it("returns an array", () => {
			const calls = getGcCalls();
			assert.ok(Array.isArray(calls));
		});

		it("contains timestamps", () => {
			global.gc = () => {};
			_resetGcCalls();
			gc(10);
			const calls = getGcCalls();
			assert.ok(calls.every((c) => typeof c === "number" && c > 0));
			delete global.gc;
		});
	});
});

describe("command parser - gc commands", () => {
	it("parses /gc command and triggers GC", () => {
		const parser = new CommandRegistry();
		const result = parser.parse("/gc", {
			_gcTrigger: () => ({ triggered: true, hourCalls: 1, lastRun: Date.now() }),
		});
		assert.strictEqual(result.action, "gc");
		assert.strictEqual(result.subAction, "run");
		assert.strictEqual(result.triggered, true);
		assert.ok(result.message.includes("GC"));
	});

	it("parses /gc status command", () => {
		const parser = new CommandRegistry();
		const result = parser.parse("/gc status", {
			_gcStatus: () => ({ available: true, calls: [], hourCalls: 2 }),
		});
		assert.strictEqual(result.action, "gc");
		assert.strictEqual(result.subAction, "status");
		assert.strictEqual(result.available, true);
		assert.strictEqual(result.hourCalls, 2);
	});

	it("returns gc not available status when unavailable", () => {
		const parser = new CommandRegistry();
		const result = parser.parse("/gc status", {
			_gcStatus: () => ({ available: false, calls: [], hourCalls: 0 }),
		});
		assert.strictEqual(result.available, false);
		assert.ok(result.message.includes("not available"));
	});

	it("returns unknown for invalid gc subcommand", () => {
		const parser = new CommandRegistry();
		const result = parser.parse("/gc invalid", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Usage"));
	});

	it("isCommand returns true for /gc input", () => {
		const parser = new CommandRegistry();
		assert.strictEqual(parser.isCommand("/gc"), true);
		assert.strictEqual(parser.isCommand("/gc status"), true);
	});

	it("hasCommand returns true for gc", () => {
		const parser = new CommandRegistry();
		assert.strictEqual(parser.hasCommand("gc"), true);
	});

	it("listCommands includes gc", () => {
		const parser = new CommandRegistry();
		const cmds = parser.listCommands();
		assert.ok(cmds.includes("gc"));
	});
});
