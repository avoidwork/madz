/**
 * Unit tests for the PPTX extraction tool.
 * @module tests/unit/fileExtract/pptx.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { pptxExtract } from "../../../src/tools/fileExtract/pptx.js";

const TMP_DIR = join(process.cwd(), "tmp", "fileExtract-pptx");

function pptxPath(name) {
	return join(TMP_DIR, name);
}

const P_NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

before(async () => {
	await mkdir(TMP_DIR, { recursive: true });

	// Create a minimal valid PPTX with adm-zip
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
		"ppt/slides/slide1.xml",
		Buffer.from(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
				`<p:slide ${P_NS} ${A_NS}>` +
				`<p:spTree>` +
				`<p:sp><p:nvSpPr><p:cNvPr name="title"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Test Title</a:t></a:r></a:p></p:txBody></p:sp>` +
				`</p:spTree>` +
				`</p:slide>`,
		),
	);

	zip.writeZip(pptxPath("test-minimal.pptx"));
});

after(async () => {
	await rm(TMP_DIR, { recursive: true, force: true });
});

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
			writeFileSync(pptxPath("test-fake-pptx.pptx"), "This is not a real PPTX file");
			const result = await pptxExtract({ filePath: pptxPath("test-fake-pptx.pptx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});

		it("should extract content from a valid PPTX file", async () => {
			const result = await pptxExtract({ filePath: pptxPath("test-minimal.pptx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.format, "markdown");
			assert.ok(typeof parsed.content === "string");
		});
	});
});
