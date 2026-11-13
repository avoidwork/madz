import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { gc, getGcCalls, initGC, _resetGcCalls, _setGcCalls } from "../../../src/memory/gc.js";

describe("memory/gc (hardening)", () => {
	let originalGc;
	beforeEach(() => {
		originalGc = global.gc;
		global.gc = () => {};
		_resetGcCalls();
	});
	afterEach(() => {
		global.gc = originalGc;
		_resetGcCalls();
	});

	it("prunes only expired calls from the front of the window", () => {
		const now = Date.now();
		_setGcCalls([now - 2 * 3600000, now - 90 * 60000, now - 1000]);
		const r = gc(4);
		assert.strictEqual(r.triggered, true);
		assert.strictEqual(r.hourCalls, 2);
		assert.strictEqual(getGcCalls().length, 2);
	});

	it("rate limits when the window is full of recent calls", () => {
		const now = Date.now();
		_setGcCalls([now - 3000, now - 2000, now - 1000]);
		assert.strictEqual(gc(3).reason, "rate limited");
	});

	it("a throwing onIdle does not crash and stop() prevents restart", async () => {
		let calls = 0;
		const ctl = initGC({
			idleTimeoutMs: 5,
			maxGcPerHour: 4,
			onIdle: () => {
				calls++;
				throw new Error("boom");
			},
		});
		await new Promise((r) => setTimeout(r, 40));
		assert.strictEqual(calls, 1);
		ctl.stop();
		ctl.onActivity();
		await new Promise((r) => setTimeout(r, 40));
		assert.strictEqual(calls, 1);
	});

	it("unrefs the idle timer", () => {
		const original = global.setTimeout;
		let unrefCalled = false;
		global.setTimeout = (...args) => {
			const t = original(...args);
			const u = t.unref.bind(t);
			t.unref = () => {
				unrefCalled = true;
				return u();
			};
			return t;
		};
		let ctl;
		try {
			ctl = initGC({ idleTimeoutMs: 1000, maxGcPerHour: 1, onIdle: () => {} });
		} finally {
			global.setTimeout = original;
			ctl?.stop();
		}
		assert.ok(unrefCalled);
	});
});
