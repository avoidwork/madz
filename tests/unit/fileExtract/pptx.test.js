/**
 * Unit tests for the PPTX extraction tool.
 * @module tests/unit/fileExtract/pptx.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { pptxExtract } from "../../../src/tools/fileExtract/pptx.js";

describe("fileExtract/pptx", () => {
	describe("pptxExtract", () => {
		it("should return an error for non-existent files", async () => {
			const result = await pptxExtract({ filePath: "/nonexistent/file.pptx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Failed to read file"));
		});

		it("should return an error for unsupported formats", async () => {
			const result = await pptxExtract({ filePath: "presentation.txt" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Unsupported format"));
		});

		it("should return an error for files without extensions", async () => {
			const result = await pptxExtract({ filePath: "presentation" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("No file extension"));
		});

		it("should return an error for non-PPTX files with .pptx extension", async () => {
			const { writeFileSync } = await import("node:fs");
			writeFileSync("/tmp/test-fake-pptx.pptx", "This is not a real PPTX file");
			const result = await pptxExtract({ filePath: "/tmp/test-fake-pptx.pptx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});
	});
});
