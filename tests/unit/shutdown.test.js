// oxlint-disable no-console

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";

import { handleShutdown, registerShutdownHandler } from "../../src/session/shutdown.js";

describe("session - shutdown handler", () => {
	it("suppresses telemetry flush errors", async () => {
		// handleShutdown with only flushTelemetry that throws should complete without error
		const flushTelemetry = () => {
			throw new Error("flush failed");
		};

		await assert.doesNotReject(
			handleShutdown({
				flushTelemetry,
			}),
		);
	});

	it("calls onSaveShutdown callback if provided", async () => {
		let called = false;
		const onShutdown = () => {
			called = true;
		};

		await handleShutdown({ onShutdown });

		assert.strictEqual(called, true, "onShutdown callback should have been called");
	});

	it("handles empty options gracefully", async () => {
		await assert.doesNotReject(handleShutdown());
	});

	it("handles options with no callbacks", async () => {
		await assert.doesNotReject(handleShutdown({}));
	});

	it("handles flushTelemetry that resolves successfully", async () => {
		let flushed = false;
		await handleShutdown({
			flushTelemetry: async () => {
				flushed = true;
			},
		});
		assert.strictEqual(flushed, true);
	});

	it("handles onShutdown that throws", async () => {
		// onShutdown errors are logged, not propagated
		await assert.doesNotReject(
			handleShutdown({
				onShutdown: () => {
					throw new Error("onShutdown error");
				},
			}),
		);
	});
});

describe("session - registerShutdownHandler hardening", () => {
	const tick = () => new Promise((r) => setTimeout(r, 200));

	it("exits with 143 for SIGTERM and 130 for SIGINT, even if handler throws", async () => {
		const codes = [];
		const remove1 = registerShutdownHandler(
			() => {
				throw new Error("boom");
			},
			{ exit: (c) => codes.push(c) },
		);
		process.emit("SIGTERM");
		await tick();
		remove1();
		const remove2 = registerShutdownHandler(() => {}, { exit: (c) => codes.push(c) });
		process.emit("SIGINT");
		await tick();
		remove2();
		assert.deepStrictEqual(codes, [143, 130]);
	});

	it("runs the handler once on repeated signals", async () => {
		let calls = 0;
		const exits = [];
		const remove = registerShutdownHandler(
			async () => {
				calls++;
			},
			{ exit: (c) => exits.push(c) },
		);
		process.emit("SIGINT");
		process.emit("SIGTERM");
		await tick();
		remove();
		assert.strictEqual(calls, 1);
		assert.strictEqual(exits.length, 1);
	});

	it("removes listeners on cleanup", () => {
		const before = process.listenerCount("SIGINT");
		const remove = registerShutdownHandler(() => {}, { exit: () => {} });
		remove();
		assert.strictEqual(process.listenerCount("SIGINT"), before);
	});
});

describe("session - registerShutdownHandler", () => {
	// Store original listeners so we can restore them
	const originalListeners = {
		SIGTERM: process.listeners("SIGTERM"),
		SIGINT: process.listeners("SIGINT"),
	};

	afterEach(() => {
		// Restore original listeners
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("SIGINT");
		for (const listener of originalListeners.SIGTERM) {
			process.on("SIGTERM", listener);
		}
		for (const listener of originalListeners.SIGINT) {
			process.on("SIGINT", listener);
		}
	});

	it("registers SIGTERM and SIGINT handlers", () => {
		const handler = () => {};
		const remove = registerShutdownHandler(handler, { exit: () => {} });

		assert.strictEqual(process.listenerCount("SIGTERM"), originalListeners.SIGTERM.length + 1);
		assert.strictEqual(process.listenerCount("SIGINT"), originalListeners.SIGINT.length + 1);

		remove();
	});

	it("returns a cleanup function that removes handlers", () => {
		const handler = () => {};
		const remove = registerShutdownHandler(handler, { exit: () => {} });

		assert.strictEqual(process.listenerCount("SIGTERM"), originalListeners.SIGTERM.length + 1);

		remove();

		assert.strictEqual(process.listenerCount("SIGTERM"), originalListeners.SIGTERM.length);
		assert.strictEqual(process.listenerCount("SIGINT"), originalListeners.SIGINT.length);
	});

	it("calls the handler and flush on signal", async () => {
		let handlerCalled = false;
		const handler = () => {
			handlerCalled = true;
		};

		const remove = registerShutdownHandler(handler, { exit: () => {} });

		// Emit SIGTERM synchronously — the wrapped handler is async but we can
		// wait for the microtask queue to drain
		process.emit("SIGTERM");
		await new Promise((resolve) => setImmediate(resolve));

		assert.strictEqual(handlerCalled, true);

		remove();
	});

	it("calls the handler on SIGINT", async () => {
		let handlerCalled = false;
		const handler = () => {
			handlerCalled = true;
		};

		const remove = registerShutdownHandler(handler, { exit: () => {} });

		process.emit("SIGINT");
		await new Promise((resolve) => setImmediate(resolve));

		assert.strictEqual(handlerCalled, true);

		remove();
	});

	it("supports multiple independent registrations", () => {
		let _callCount = 0;
		const handler1 = () => {
			_callCount++;
		};
		const handler2 = () => {
			_callCount++;
		};

		const remove1 = registerShutdownHandler(handler1, { exit: () => {} });
		const remove2 = registerShutdownHandler(handler2, { exit: () => {} });

		assert.strictEqual(process.listenerCount("SIGTERM"), originalListeners.SIGTERM.length + 2);

		remove1();
		remove2();

		assert.strictEqual(process.listenerCount("SIGTERM"), originalListeners.SIGTERM.length);
	});

	it("removeHandlers is idempotent", () => {
		const handler = () => {};
		const remove = registerShutdownHandler(handler, { exit: () => {} });

		remove();
		// Calling remove again should not throw
		assert.doesNotThrow(() => remove());
	});
});
