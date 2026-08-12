/**
 * Unit tests for the PDF extraction tool.
 * @module tests/unit/fileExtract/pdf.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { pdfExtract } from "../../../src/tools/fileExtract/pdf.js";

describe("fileExtract/pdf", () => {
	describe("pdfExtract", () => {
		it("should return an error for non-existent files", async () => {
			const result = await pdfExtract({ filePath: "/nonexistent/file.pdf" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Failed to read file"));
		});

		it("should return an error for unsupported formats", async () => {
			const result = await pdfExtract({ filePath: "document.txt" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Unsupported format"));
		});

		it("should return an error for files without extensions", async () => {
			const result = await pdfExtract({ filePath: "document" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("No file extension"));
		});

		it("should return an error for non-PDF files with .pdf extension", async () => {
			const { writeFileSync } = await import("node:fs");
			writeFileSync("/tmp/test-fake-pdf.pdf", "This is not a real PDF file");
			const result = await pdfExtract({ filePath: "/tmp/test-fake-pdf.pdf" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("PDF extraction failed"));
		});
	});
});
