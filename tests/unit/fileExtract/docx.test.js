/**
 * Unit tests for the DOCX extraction tool.
 * @module tests/unit/fileExtract/docx.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { docxExtract } from "../../../src/tools/fileExtract/docx.js";

const TMP_DIR = join(process.cwd(), "tmp", "fileExtract-docx");

function docxPath(name) {
	return join(TMP_DIR, name);
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

before(async () => {
	await mkdir(TMP_DIR, { recursive: true });

	// Create a minimal valid DOCX with adm-zip
	const { default: AdmZip } = await import("adm-zip");
	const zip = new AdmZip();

	zip.addFile(
		"[Content_Types].xml",
		Buffer.from(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				"</Types>",
		),
	);

	zip.addFile(
		"word/document.xml",
		Buffer.from(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
				`<w:document ${W_NS}>` +
				`<w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body>` +
				`</w:document>`,
		),
	);

	zip.writeZip(docxPath("test-minimal.docx"));
});

after(async () => {
	await rm(TMP_DIR, { recursive: true, force: true });
});

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
			writeFileSync(docxPath("test-fake-docx.docx"), "This is not a real DOCX file");
			const result = await docxExtract({ filePath: docxPath("test-fake-docx.docx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});

		it("should extract content from a valid DOCX file", async () => {
			const result = await docxExtract({ filePath: docxPath("test-minimal.docx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.format, "markdown");
			assert.ok(typeof parsed.content === "string");
		});

		it("should handle empty document XML gracefully", async () => {
			const { default: AdmZip } = await import("adm-zip");
			const zip = new AdmZip();
			zip.addFile(
				"[Content_Types].xml",
				Buffer.from(
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
				),
			);
			zip.writeZip(docxPath("test-empty-docx.docx"));
			const result = await docxExtract({ filePath: docxPath("test-empty-docx.docx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("No word/document.xml"));
		});
	});
});
