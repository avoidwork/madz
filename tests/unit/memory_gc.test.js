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

describe("memory/gc", () => {
	beforeEach(() => {
		global.gc = undefined;
		delete process[Symbol.for("madz.gc.warned")];
		_resetGcCalls();
	});

	describe("isAvailable", () => {
		it("returns false when global.gc is undefined", () => {
			assert.strictEqual(isAvailable(), false);
		});

		it("returns true when global.gc is a function", () => {
			global.gc = () => {};
			assert.strictEqual(isAvailable(), true);
		});

		it("returns boolean", () => {
			assert.strictEqual(typeof isAvailable(), "boolean");
		});
	});

	describe("gc", () => {
		it("returns { triggered: false, reason: 'gc not available' } when global.gc is undefined", () => {
			const result = gc(4);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "gc not available");
			assert.ok(typeof result.hourCalls === "number");
		});

		it("does not throw when global.gc is undefined", () => {
			assert.doesNotThrow(() => gc(4));
		});

		it("returns { triggered: true } when global.gc is available", () => {
			global.gc = () => {};
			const result = gc(4);
			assert.strictEqual(result.triggered, true);
			assert.ok(typeof result.lastRun === "number");
			assert.ok(result.hourCalls >= 1);
		});

		it("calls global.gc() when available", () => {
			let called = false;
			global.gc = () => {
				called = true;
			};
			gc(4);
			assert.strictEqual(called, true);
		});

		it("rate limits when maxGcPerHour is exceeded using _setGcCalls", () => {
			global.gc = () => {};
			const now = Date.now();
			// Inject 2 recent timestamps, then call with maxGcPerHour=1
			_setGcCalls([now, now]);
			const result = gc(1);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "rate limited");
			assert.strictEqual(result.hourCalls, 1);
		});

		it("does not rate limit when under maxGcPerHour", () => {
			global.gc = () => {};
			_setGcCalls([]);
			const result = gc(1);
			assert.strictEqual(result.triggered, true);
		});

		it("prunes stale timestamps before checking rate limit", () => {
			global.gc = () => {};
			// Inject two stale timestamps (both older than 1 hour)
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000, Date.now() - 1.5 * 60 * 60 * 1000]);
			// After pruning, hourCalls=0 → under maxGcPerHour=2 → proceeds
			const result = gc(2);
			assert.strictEqual(result.triggered, true);
			// Verify only the new call remains
			assert.strictEqual(getGcCalls().length, 1);
		});

		it("returns hourCalls reflecting pruned count when gc not available", () => {
			// Inject stale timestamps that will be pruned
			_setGcCalls([Date.now() - 2 * 60 * 60 * 1000]);
			const result = gc(4);
			assert.strictEqual(result.triggered, false);
			assert.strictEqual(result.reason, "gc not available");
			// After pruning, hourCalls should be 0
			assert.strictEqual(result.hourCalls, 0);
		});
	});

	describe("getGcCalls", () => {
		it("returns an empty array when no calls have been made", () => {
			const calls = getGcCalls();
			assert.ok(Array.isArray(calls));
			assert.strictEqual(calls.length, 0);
		});

		it("returns timestamps within the current hour window after gc()", () => {
			global.gc = () => {};
			_resetGcCalls();
			gc(10);
			const calls = getGcCalls();
			assert.strictEqual(calls.length, 1);
			assert.ok(typeof calls[0] === "number");
		});

		it("filters out timestamps older than one hour", () => {
			const old = Date.now() - 2 * 60 * 60 * 1000;
			const recent = Date.now();
			_setGcCalls([old, recent]);
			const calls = getGcCalls();
			assert.strictEqual(calls.length, 1);
			assert.ok(calls[0] >= recent - 100, "remaining timestamp should be the recent one");
		});
	});

	describe("_resetGcCalls", () => {
		it("clears the gcCalls array", () => {
			_setGcCalls([Date.now(), Date.now()]);
			assert.strictEqual(getGcCalls().length, 2);
			_resetGcCalls();
			assert.strictEqual(getGcCalls().length, 0);
		});

		it("allows gc() to proceed after reset", () => {
			global.gc = () => {};
			_setGcCalls([Date.now(), Date.now()]);
			assert.strictEqual(gc(1).triggered, false); // rate limited
			_resetGcCalls();
			assert.strictEqual(gc(1).triggered, true); // proceeds after reset
		});
	});

	describe("initGC", () => {
		it("returns a controller with stop and onActivity methods", () => {
			const controller = initGC({
				idleTimeoutMs: 60000,
				maxGcPerHour: 4,
				onIdle: () => {},
			});
			assert.ok(typeof controller.stop === "function");
			assert.ok(typeof controller.onActivity === "function");
			controller.stop();
		});

		it("calls setTimeout to schedule the idle callback", () => {
			const originalSetTimeout = global.setTimeout;
			let capturedArgs = null;
			global.setTimeout = (...args) => {
				capturedArgs = args;
				return 123; // fake timer ID
			};
			try {
				const controller = initGC({
					idleTimeoutMs: 5000,
					maxGcPerHour: 4,
					onIdle: () => {},
				});
				assert.ok(capturedArgs !== null, "setTimeout was not called");
				assert.strictEqual(capturedArgs[1], 5000, "setTimeout delay should match idleTimeoutMs");
				controller.stop();
			} finally {
				global.setTimeout = originalSetTimeout;
			}
		});

		it("onActivity resets the idle timer (delaying the callback)", async () => {
			let callCount = 0;
			const controller = initGC({
				idleTimeoutMs: 80,
				maxGcPerHour: 4,
				onIdle: () => {
					callCount++;
				},
			});
			// Call onActivity twice to keep resetting the timer
			controller.onActivity();
			await new Promise((r) => setTimeout(r, 30));
			controller.onActivity();
			await new Promise((r) => setTimeout(r, 30));
			// Timer should have been reset by the second onActivity call
			assert.strictEqual(callCount, 0);
			controller.stop();
		});

		it("stop() clears the idle timer and prevents the callback", async () => {
			let triggered = false;
			const controller = initGC({
				idleTimeoutMs: 50,
				maxGcPerHour: 4,
				onIdle: () => {
					triggered = true;
				},
			});
			controller.stop();
			await new Promise((r) => setTimeout(r, 100));
			assert.strictEqual(triggered, false);
		});

		it("triggers onIdle after the idle timeout elapses", async () => {
			let triggered = false;
			const controller = initGC({
				idleTimeoutMs: 30,
				maxGcPerHour: 4,
				onIdle: () => {
					triggered = true;
				},
			});
			await new Promise((r) => setTimeout(r, 60));
			assert.strictEqual(triggered, true);
			controller.stop();
		});
	});
});
