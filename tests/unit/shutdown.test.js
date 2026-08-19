// oxlint-disable no-console

import { describe, it } from "node:test";
import assert from "node:assert";

import { handleShutdown } from "../../src/session/shutdown.js";

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
});
