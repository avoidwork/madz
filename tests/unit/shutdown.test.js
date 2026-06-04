// oxlint-disable no-console

import { describe, it } from "node:test";
import assert from "node:assert";
import { handleShutdown } from "../../src/session/shutdown.js";

describe("session - shutdown handler", () => {
	it("re-throws errors from saveSession", async () => {
		const testError = new Error("save failed");

		await assert.rejects(
			handleShutdown({
				saveSession: () => {
					throw testError;
				},
			}),
			testError,
			"handleShutdown should propagate saveSession errors",
		);
	});

	it("suppresses telemetry flush errors", async () => {
		// Create a mock console.error to capture output
		/** @type {string[]} */
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => {
			errors.push(args.join(" "));
		};

		// handleShutdown with only flushTelemetry that throws should complete without error
		const flushTelemetry = () => {
			throw new Error("flush failed");
		};

		await assert.doesNotReject(
			handleShutdown({
				flushTelemetry,
			}),
		);

		// Restore console.error
		console.error = originalError;

		// Should have logged the error
		assert.ok(errors.length > 0, "should have logged telemetry flush error");
		assert.ok(errors[0].includes("telemetry"), "error message should mention telemetry");
	});

	it("calls onSaveShutdown callback if provided", async () => {
		let called = false;
		const onShutdown = () => {
			called = true;
		};

		await handleShutdown({ onShutdown });

		assert.strictEqual(called, true, "onShutdown callback should have been called");
	});

	it("executes saveSession after flushTelemetry", async () => {
		/** @type {(string) => void} */
		const steps = [];

		await handleShutdown({
			flushTelemetry: () => {
				steps.push("flush");
			},
			saveSession: () => {
				steps.push("save");
			},
		});

		assert.deepStrictEqual(steps, ["flush", "save"], "should flush telemetry before saveSession");
	});
});
