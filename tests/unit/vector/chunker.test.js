import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chunkContent, chunkFile } from "../../../src/vector/chunker.js";

describe("chunkContent", () => {
	it("returns empty array for empty content", () => {
		const result = chunkContent("test.js", "", 96, 16);
		assert.strictEqual(result.length, 0);
	});

	it("returns empty array for null content", () => {
		const result = chunkContent("test.js", null, 96, 16);
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

	it("handles exact multiple of chunk size", () => {
		const lines = [];
		for (let i = 1; i <= 96; i++) {
			lines.push(`line${i}`);
		}
		const content = lines.join("\n");
		const result = chunkContent("test.js", content, 96, 16);
		assert.strictEqual(result.length, 1);
	});

	it("handles zero overlap", () => {
		const lines = [];
		for (let i = 1; i <= 200; i++) {
			lines.push(`line${i}`);
		}
		const content = lines.join("\n");
		const result = chunkContent("test.js", content, 50, 0);
		assert.ok(result.length >= 4);
		assert.strictEqual(result[0].lineStart, 1);
		assert.strictEqual(result[0].lineEnd, 50);
		assert.strictEqual(result[1].lineStart, 51);
		assert.strictEqual(result[1].lineEnd, 100);
	});

	it("handles content with trailing newline", () => {
		const result = chunkContent("test.js", "a\nb\nc\n", 96, 16);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].lineStart, 1);
		assert.strictEqual(result[0].lineEnd, 4);
	});

	it("handles content with only newlines", () => {
		const result = chunkContent("test.js", "\n\n\n", 2, 0);
		assert.strictEqual(result.length, 2);
	});
});

describe("chunkFile", () => {
	/** @type {string} */
	let tmpDir;

	before(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "chunkfile-"));
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns empty array for binary extension", async () => {
		const result = await chunkFile(join(tmpDir, "image.png"), {});
		assert.strictEqual(result.length, 0);
	});

	it("returns empty array for non-existent file", async () => {
		const result = await chunkFile(join(tmpDir, "nonexistent.js"), {});
		assert.strictEqual(result.length, 0);
	});

	it("returns empty array for file exceeding maxFileSize", async () => {
		const filePath = join(tmpDir, "large.js");
		writeFileSync(filePath, "x");
		const result = await chunkFile(filePath, { maxFileSize: 0 });
		assert.strictEqual(result.length, 0);
	});

	it("returns empty array for binary content (null bytes)", async () => {
		const filePath = join(tmpDir, "binary.js");
		writeFileSync(filePath, "text\x00with\x00nulls");
		const result = await chunkFile(filePath, { maxFileSize: 524288 });
		assert.strictEqual(result.length, 0);
	});

	it("chunks a valid text file", async () => {
		const filePath = join(tmpDir, "valid.js");
		writeFileSync(filePath, "line1\nline2\nline3\n");
		const result = await chunkFile(filePath, { chunkSize: 96, overlap: 16, maxFileSize: 524288 });
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].lineStart, 1);
		// Trailing newline creates an empty line — 4 lines total
		assert.strictEqual(result[0].lineEnd, 4);
	});
});
