import { describe, it } from "node:test";
import assert from "node:assert";
import { createCheckpointer } from "../../src/session/checkpointer.js";
import { MemorySaver } from "@langchain/langgraph";

describe("createCheckpointer", () => {
	it("returns MemorySaver for memory mode", () => {
		const cp = createCheckpointer({ mode: "memory" });
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns MemorySaver when config is empty", () => {
		const cp = createCheckpointer({});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null when config is undefined", () => {
		const cp = createCheckpointer(undefined);
		assert.strictEqual(cp, null);
	});

	it("returns MemorySaver for unknown mode (fallback)", () => {
		const cp = createCheckpointer({ mode: "redis" });
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null for null config", () => {
		const cp = createCheckpointer(null);
		assert.strictEqual(cp, null);
	});

	it("falls back to MemorySaver for unrecognized mode string", () => {
		const cp = createCheckpointer({ mode: "postgres" });
		assert.ok(cp instanceof MemorySaver);
	});
});
