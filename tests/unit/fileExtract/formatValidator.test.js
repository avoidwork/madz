/**
 * Unit tests for the format validation utility.
 * @module tests/unit/fileExtract/formatValidator.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	validateFormat,
	SUPPORTED_FORMATS,
} from "../../../src/tools/fileExtract/formatValidator.js";

describe("fileExtract/formatValidator", () => {
	describe("SUPPORTED_FORMATS", () => {
		it("should include all expected formats", () => {
			assert.ok(SUPPORTED_FORMATS.has("docx"));
			assert.ok(SUPPORTED_FORMATS.has("pptx"));
			assert.ok(SUPPORTED_FORMATS.has("xlsx"));
			assert.ok(SUPPORTED_FORMATS.has("pdf"));
		});

		it("should have at least 4 supported formats", () => {
			assert.ok(SUPPORTED_FORMATS.size >= 4);
		});
	});

	describe("validateFormat", () => {
		it("should validate docx files", () => {
			const result = validateFormat("document.docx");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "docx");
		});

		it("should validate pptx files", () => {
			const result = validateFormat("presentation.pptx");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "pptx");
		});

		it("should validate xlsx files", () => {
			const result = validateFormat("spreadsheet.xlsx");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "xlsx");
		});

		it("should validate pdf files", () => {
			const result = validateFormat("document.pdf");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "pdf");
		});

		it("should reject unsupported formats", () => {
			const result = validateFormat("document.txt");
			assert.strictEqual(result.valid, false);
			assert.ok(result.error.includes("Unsupported format"));
		});

		it("should reject files without extensions", () => {
			const result = validateFormat("document");
			assert.strictEqual(result.valid, false);
			assert.ok(result.error.includes("No file extension"));
		});

		it("should handle case-insensitive extensions", () => {
			const result = validateFormat("document.DOCX");
			assert.strictEqual(result.valid, true);
		});

		it("should handle paths with directories", () => {
			const result = validateFormat("/path/to/document.docx");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "docx");
		});
	});
});
