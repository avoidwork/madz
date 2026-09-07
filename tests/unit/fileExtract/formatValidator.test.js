/**
 * Unit tests for the format validation utility.
 * @module tests/unit/fileExtract/formatValidator.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	validateFormat,
	isZipFormat,
	usesXmlExtraction,
	getInternalPaths,
	getExtension,
	SUPPORTED_FORMATS,
	ZIP_FORMATS,
	PDF_FORMATS,
	ZIP_XML_FORMATS,
	INTERNAL_XML_PATHS,
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

	describe("ZIP_FORMATS", () => {
		it("should include docx, pptx, xlsx, odt, ods, odp, epub", () => {
			assert.ok(ZIP_FORMATS.has("docx"));
			assert.ok(ZIP_FORMATS.has("pptx"));
			assert.ok(ZIP_FORMATS.has("xlsx"));
			assert.ok(ZIP_FORMATS.has("odt"));
			assert.ok(ZIP_FORMATS.has("ods"));
			assert.ok(ZIP_FORMATS.has("odp"));
			assert.ok(ZIP_FORMATS.has("epub"));
		});

		it("should not include pdf", () => {
			assert.ok(!ZIP_FORMATS.has("pdf"));
		});
	});

	describe("PDF_FORMATS", () => {
		it("should include pdf", () => {
			assert.ok(PDF_FORMATS.has("pdf"));
		});
	});

	describe("ZIP_XML_FORMATS", () => {
		it("should include docx, pptx, xlsx, odt, ods, odp", () => {
			assert.ok(ZIP_XML_FORMATS.has("docx"));
			assert.ok(ZIP_XML_FORMATS.has("pptx"));
			assert.ok(ZIP_XML_FORMATS.has("xlsx"));
			assert.ok(ZIP_XML_FORMATS.has("odt"));
			assert.ok(ZIP_XML_FORMATS.has("ods"));
			assert.ok(ZIP_XML_FORMATS.has("odp"));
		});

		it("should not include epub", () => {
			assert.ok(!ZIP_XML_FORMATS.has("epub"));
		});
	});

	describe("INTERNAL_XML_PATHS", () => {
		it("should define paths for docx", () => {
			const paths = INTERNAL_XML_PATHS.docx;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("word/document.xml"));
		});

		it("should define paths for pptx", () => {
			const paths = INTERNAL_XML_PATHS.pptx;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("ppt/slides/slide*.xml"));
		});

		it("should define paths for xlsx", () => {
			const paths = INTERNAL_XML_PATHS.xlsx;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("xl/workbook.xml"));
		});

		it("should define paths for odt", () => {
			const paths = INTERNAL_XML_PATHS.odt;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("content.xml"));
		});

		it("should define paths for ods", () => {
			const paths = INTERNAL_XML_PATHS.ods;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("content.xml"));
		});

		it("should define paths for odp", () => {
			const paths = INTERNAL_XML_PATHS.odp;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("content.xml"));
		});

		it("should define paths for epub", () => {
			const paths = INTERNAL_XML_PATHS.epub;
			assert.ok(Array.isArray(paths));
			assert.ok(paths.includes("OEBPS/content.opf"));
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

		it("should validate odt files", () => {
			const result = validateFormat("document.odt");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "odt");
		});

		it("should validate epub files", () => {
			const result = validateFormat("book.epub");
			assert.strictEqual(result.valid, true);
			assert.strictEqual(result.format, "epub");
		});
	});

	describe("isZipFormat", () => {
		it("should return true for docx", () => {
			assert.strictEqual(isZipFormat("docx"), true);
		});

		it("should return true for pptx", () => {
			assert.strictEqual(isZipFormat("pptx"), true);
		});

		it("should return true for xlsx", () => {
			assert.strictEqual(isZipFormat("xlsx"), true);
		});

		it("should return false for pdf", () => {
			assert.strictEqual(isZipFormat("pdf"), false);
		});

		it("should return false for unknown format", () => {
			assert.strictEqual(isZipFormat("txt"), false);
		});
	});

	describe("usesXmlExtraction", () => {
		it("should return true for docx", () => {
			assert.strictEqual(usesXmlExtraction("docx"), true);
		});

		it("should return true for pptx", () => {
			assert.strictEqual(usesXmlExtraction("pptx"), true);
		});

		it("should return true for xlsx", () => {
			assert.strictEqual(usesXmlExtraction("xlsx"), true);
		});

		it("should return false for epub", () => {
			assert.strictEqual(usesXmlExtraction("epub"), false);
		});

		it("should return false for pdf", () => {
			assert.strictEqual(usesXmlExtraction("pdf"), false);
		});

		it("should return false for unknown format", () => {
			assert.strictEqual(usesXmlExtraction("txt"), false);
		});
	});

	describe("getInternalPaths", () => {
		it("should return paths for docx", () => {
			const paths = getInternalPaths("docx");
			assert.ok(Array.isArray(paths));
			assert.ok(paths.length > 0);
		});

		it("should return paths for pptx", () => {
			const paths = getInternalPaths("pptx");
			assert.ok(Array.isArray(paths));
			assert.ok(paths.length > 0);
		});

		it("should return null for unknown format", () => {
			assert.strictEqual(getInternalPaths("txt"), null);
		});

		it("should return null for pdf", () => {
			assert.strictEqual(getInternalPaths("pdf"), null);
		});
	});

	describe("getExtension", () => {
		it("should extract extension from simple filename", () => {
			assert.strictEqual(getExtension("file.txt"), "txt");
		});

		it("should extract extension from path with directories", () => {
			assert.strictEqual(getExtension("/path/to/file.docx"), "docx");
		});

		it("should extract extension from Windows path", () => {
			assert.strictEqual(getExtension("C:\\path\\to\\file.pdf"), "pdf");
		});

		it("should return lowercase extension", () => {
			assert.strictEqual(getExtension("file.DOCX"), "docx");
		});

		it("should return null for file without extension", () => {
			assert.strictEqual(getExtension("file"), null);
		});

		it("should return null for hidden file without extension", () => {
			assert.strictEqual(getExtension(".gitignore"), null);
		});

		it("should return extension for hidden file with extension", () => {
			assert.strictEqual(getExtension(".hidden.txt"), "txt");
		});

		it("should handle multiple dots", () => {
			assert.strictEqual(getExtension("archive.tar.gz"), "gz");
		});

		it("should handle empty path", () => {
			assert.strictEqual(getExtension(""), null);
		});
	});
});
