import { describe, it } from "node:test";
import assert from "node:assert";
import { isSubagentNamespace } from "../../../src/stream/namespace.js";

describe("isSubagentNamespace", () => {
	it("treats the root graph namespace as the orchestrator", () => {
		assert.strictEqual(isSubagentNamespace([]), false);
	});

	it("treats a single tools: segment as a subagent (deepagents 1.16 shape)", () => {
		assert.strictEqual(isSubagentNamespace(["tools:abc"]), true);
	});

	it("treats a nested tools: namespace as a subagent", () => {
		assert.strictEqual(isSubagentNamespace(["tools:abc", "model_request:def"]), true);
		assert.strictEqual(isSubagentNamespace(["model_request:def", "tools:abc"]), true);
	});

	it("treats a namespace without a tools: segment as the orchestrator", () => {
		assert.strictEqual(isSubagentNamespace(["model_request:def"]), false);
	});

	it("rejects non-array and non-string input", () => {
		assert.strictEqual(isSubagentNamespace(undefined), false);
		assert.strictEqual(isSubagentNamespace(null), false);
		assert.strictEqual(isSubagentNamespace("tools:abc"), false);
		assert.strictEqual(isSubagentNamespace([null, 1]), false);
	});
});
