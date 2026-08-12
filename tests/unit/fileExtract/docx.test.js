/**
 * Unit tests for the DOCX extraction tool.
 * @module tests/unit/fileExtract/docx.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { docxExtract } from "../../../src/tools/fileExtract/docx.js";

describe("fileExtract/docx", () => {
	describe("docxExtract", () => {
		it("should return an error for non-existent files", async () => {
			const result = await docxExtract({ filePath: "/nonexistent/file.docx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Failed to read file"));
		});

		it("should return an error for unsupported formats", async () => {
			const result = await docxExtract({ filePath: "document.txt" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Unsupported format"));
		});

		it("should return an error for files without extensions", async () => {
			const result = await docxExtract({ filePath: "document" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("No file extension"));
		});

		it("should return an error for non-DOCX files with .docx extension", async () => {
			// Create a text file and try to extract it as DOCX
			const { writeFileSync } = await import("node:fs");
			writeFileSync("/tmp/test-fake-docx.docx", "This is not a real DOCX file");
			const result = await docxExtract({ filePath: "/tmp/test-fake-docx.docx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});
	});
});
