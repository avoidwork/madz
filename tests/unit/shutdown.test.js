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

	it("passes saveSessionArgs to saveSession", async () => {
		/** @type {any[]} */
		const receivedArgs = [];

		const conversation = [
			{ role: "user", content: "hello", timestamp: "2026-01-01T00:00:00.000Z" },
			{ role: "assistant", content: "hi", timestamp: "2026-01-01T00:00:01.000Z" },
		];

		await handleShutdown({
			saveSession: (...args) => {
				receivedArgs.push(...args);
			},
			saveSessionArgs: ["memory/sessions/", conversation, "thread-123"],
		});

		assert.deepStrictEqual(
			receivedArgs,
			["memory/sessions/", conversation, "thread-123"],
			"saveSession should receive the provided arguments",
		);
	});

	it("calls saveSession with no args when saveSessionArgs is omitted", async () => {
		let argCount = null;

		await handleShutdown({
			saveSession: (...args) => {
				argCount = args.length;
			},
		});

		assert.strictEqual(
			argCount,
			0,
			"saveSession should be called with no args when saveSessionArgs is omitted",
		);
	});
});
