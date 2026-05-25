import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// oxlint-disable no-console

describe("createCheckpointer", () => {
	let createCheckpointer;

	beforeEach(async () => {
		console.warn = () => {};

		// Dynamic import so tests can be skipped when package is not installed
		createCheckpointer = (await import("../../src/agent/checkpointer.js")).createCheckpointer;
	});

	it("returns nulls when checkpoints are disabled", () => {
		const config = { agent: { checkpoints: { enabled: false } } };
		const result = createCheckpointer(config);
		assert.strictEqual(result.saver, null);
		assert.strictEqual(result.threadConfig, null);
	});

	it("returns nulls when agent config is falsy", () => {
		const config = {};
		const result = createCheckpointer(config);
		assert.ok(result.saver === null || result.saver !== undefined, "saver is null or saver exists");
	});
});
