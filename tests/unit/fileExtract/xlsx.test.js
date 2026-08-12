/**
 * Unit tests for the XLSX extraction tool.
 * @module tests/unit/fileExtract/xlsx.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { xlsxExtract } from "../../../src/tools/fileExtract/xlsx.js";

describe("fileExtract/xlsx", () => {
	describe("xlsxExtract", () => {
		it("should return an error for non-existent files", async () => {
			const result = await xlsxExtract({ filePath: "/nonexistent/file.xlsx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Failed to read file"));
		});

		it("should return an error for unsupported formats", async () => {
			const result = await xlsxExtract({ filePath: "spreadsheet.txt" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("Unsupported format"));
		});

		it("should return an error for files without extensions", async () => {
			const result = await xlsxExtract({ filePath: "spreadsheet" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("No file extension"));
		});

		it("should return an error for non-XLSX files with .xlsx extension", async () => {
			const { writeFileSync } = await import("node:fs");
			writeFileSync("/tmp/test-fake-xlsx.xlsx", "This is not a real XLSX file");
			const result = await xlsxExtract({ filePath: "/tmp/test-fake-xlsx.xlsx" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});
	});
});
