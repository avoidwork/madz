/**
 * Tests for the session shutdown module.
 * @see {@link src/session/shutdown.js}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { handleShutdown, registerShutdownHandler } from "../../../src/session/shutdown.js";

describe("handleShutdown", () => {
	it("should call flushTelemetry when provided", async () => {
		let flushed = false;
		const result = await handleShutdown({
			flushTelemetry: async () => { flushed = true; },
		});
		assert.strictEqual(flushed, true);
		assert.strictEqual(result, undefined);
	});

	it("should call onShutdown when provided", async () => {
		let cleanedUp = false;
		const result = await handleShutdown({
			onShutdown: async () => { cleanedUp = true; },
		});
		assert.strictEqual(cleanedUp, true);
		assert.strictEqual(result, undefined);
	});

	it("should call both flushTelemetry and onShutdown", async () => {
		let flushed = false;
		let cleanedUp = false;
		await handleShutdown({
			flushTelemetry: async () => { flushed = true; },
			onShutdown: async () => { cleanedUp = true; },
		});
		assert.strictEqual(flushed, true);
		assert.strictEqual(cleanedUp, true);
	});

	it("should handle flushTelemetry errors gracefully", async () => {
		// Should not throw — logs error internally
		await assert.doesNotReject(
			handleShutdown({
				flushTelemetry: async () => { throw new Error("flush failed"); },
			}),
		);
	});

	it("should throw on onShutdown errors", async () => {
		await assert.rejects(
			handleShutdown({
				onShutdown: async () => { throw new Error("shutdown failed"); },
			}),
			/shutdown failed/,
		);
	});

	it("should do nothing when no options provided", async () => {
		await assert.doesNotReject(handleShutdown());
	});

	it("should do nothing with empty options object", async () => {
		await assert.doesNotReject(handleShutdown({}));
	});
});

describe("registerShutdownHandler", () => {
	let removeHandlers;

	afterEach(() => {
		if (removeHandlers) {
			removeHandlers();
		}
	});

	it("should register SIGTERM and SIGINT handlers", async () => {
		let called = false;
		removeHandlers = registerShutdownHandler(async () => { called = true; });
		assert.strictEqual(called, false);
	});

	it("should call the handler when triggered", async () => {
		let called = false;
		removeHandlers = registerShutdownHandler(async () => { called = true; });

		// Simulate SIGTERM
		process.emit("SIGTERM");
		await new Promise((r) => setTimeout(r, 50));
		assert.strictEqual(called, true);
	});

	it("should call flush after handler", async () => {
		let flushed = false;
		removeHandlers = registerShutdownHandler(async () => {
			flushed = true;
		});

		process.emit("SIGTERM");
		await new Promise((r) => setTimeout(r, 50));
		assert.strictEqual(flushed, true);
	});

	it("should allow removing handlers", async () => {
		let called = false;
		removeHandlers = registerShutdownHandler(async () => { called = true; });
		removeHandlers();

		// Handler should not be called after removal
		process.emit("SIGTERM");
		await new Promise((r) => setTimeout(r, 50));
		assert.strictEqual(called, false);
	});

	it("should handle SIGINT", async () => {
		let called = false;
		removeHandlers = registerShutdownHandler(async () => { called = true; });

		process.emit("SIGINT");
		await new Promise((r) => setTimeout(r, 50));
		assert.strictEqual(called, true);
	});
});
