import { describe, it } from "node:test";
import assert from "node:assert";

describe("code tool dispatcher", () => {
	it("dispatches action 'search' to searchCodeImpl", async () => {
		const { codeImpl } = await import("../../../src/tools/code/code.js");
		// searchCodeImpl with no projects returns the "Unknown project" error.
		const result = await codeImpl(
			{ action: "search", query: "hello", topK: 5 },
			{ vector: { projects: {} } },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unknown project"), `Got: ${result.error}`);
	});

	it("dispatches action 'index' to indexCodeImpl", async () => {
		const { codeImpl } = await import("../../../src/tools/code/code.js");
		// indexCodeImpl with no projects returns the "No vector projects configured" error.
		const result = await codeImpl({ action: "index" }, { vector: { projects: {} } });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("No vector projects configured"), `Got: ${result.error}`);
	});
});

describe("code tool schema", () => {
	it("discriminates search action", async () => {
		const { CodeToolSchema } = await import("../../../src/tools/code/code.js");
		const parsed = CodeToolSchema.parse({ action: "search", query: "hello", topK: 5 });
		assert.strictEqual(parsed.action, "search");
		assert.strictEqual(parsed.query, "hello");
	});

	it("discriminates index action", async () => {
		const { CodeToolSchema } = await import("../../../src/tools/code/code.js");
		const parsed = CodeToolSchema.parse({ action: "index", project: "madz", force: true });
		assert.strictEqual(parsed.action, "index");
		assert.strictEqual(parsed.force, true);
	});

	it("rejects a search action without a query", async () => {
		const { CodeToolSchema } = await import("../../../src/tools/code/code.js");
		assert.throws(() => CodeToolSchema.parse({ action: "search" }));
	});

	it("rejects an unknown action", async () => {
		const { CodeToolSchema } = await import("../../../src/tools/code/code.js");
		assert.throws(() => CodeToolSchema.parse({ action: "bogus" }));
	});
});
