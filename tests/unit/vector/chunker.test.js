import { describe, it } from "node:test";
import assert from "node:assert";
import { chunkContent } from "../../../src/vector/chunker.js";

describe("chunkContent", () => {
	it("returns empty array for empty content", () => {
		const result = chunkContent("test.js", "", 96, 16);
		assert.strictEqual(result.length, 0);
	});

	it("returns single chunk for file smaller than chunk size", () => {
		const content = "line1\nline2\nline3\nline4\nline5";
		const result = chunkContent("test.js", content, 96, 16);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].lineStart, 1);
		assert.strictEqual(result[0].lineEnd, 5);
		assert.strictEqual(result[0].filePath, "test.js");
	});

	it("splits file into multiple chunks with overlap", () => {
		const lines = [];
		for (let i = 1; i <= 200; i++) {
			lines.push(`line${i}`);
		}
		const content = lines.join("\n");
		const result = chunkContent("test.js", content, 96, 16);
		assert.ok(result.length >= 2, `Expected at least 2 chunks, got ${result.length}`);
		assert.strictEqual(result[0].lineStart, 1);
		assert.strictEqual(result[0].lineEnd, 96);
		assert.strictEqual(result[1].lineStart, 81);
		assert.strictEqual(result[1].lineEnd, 176);
	});

	it("handles single line file", () => {
		const result = chunkContent("single.js", "only line", 96, 16);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].lineStart, 1);
		assert.strictEqual(result[0].lineEnd, 1);
	});

	it("preserves file path in each chunk", () => {
		const content = "a\nb\nc\nd\ne";
		const result = chunkContent("src/foo/bar.js", content, 3, 1);
		for (const chunk of result) {
			assert.strictEqual(chunk.filePath, "src/foo/bar.js");
		}
	});

	it("handles overlap larger than chunk size gracefully", () => {
		const content = "a\nb\nc";
		const result = chunkContent("test.js", content, 3, 10);
		assert.strictEqual(result.length, 1);
	});
});
