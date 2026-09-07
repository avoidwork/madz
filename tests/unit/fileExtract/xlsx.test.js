/**
 * Unit tests for the XLSX extraction tool.
 * @module tests/unit/fileExtract/xlsx.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { xlsxExtract } from "../../../src/tools/fileExtract/xlsx.js";

const TMP_DIR = join(process.cwd(), "tmp", "fileExtract-xlsx");

function xlsxPath(name) {
	return join(TMP_DIR, name);
}

const SPREADSHEET_NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

before(async () => {
	await mkdir(TMP_DIR, { recursive: true });

	// Create a minimal valid XLSX with adm-zip
	const { default: AdmZip } = await import("adm-zip");
	const zip = new AdmZip();

	zip.addFile(
		"[Content_Types].xml",
		Buffer.from(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
			'<Default Extension="xml" ContentType="application/xml"/>' +
			'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
			'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
			'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
			'</Types>',
		),
	);

	zip.addFile(
		"xl/workbook.xml",
		Buffer.from(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
			`<workbook ${SPREADSHEET_NS} ${R_NS}>` +
			`<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>` +
			`</workbook>`,
		),
	);

	zip.addFile(
		"xl/_rels/workbook.xml.rels",
		Buffer.from(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
			'</Relationships>',
		),
	);

	zip.addFile(
		"xl/worksheets/sheet1.xml",
		Buffer.from(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
			`<worksheet ${SPREADSHEET_NS}>` +
			`<sheetData>` +
			`<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Value</t></is></c></row>` +
			`<row r="2"><c r="A2" t="inlineStr"><is><t>Alpha</t></is></c><c r="B2" t="n"><v>42</v></c></row>` +
			`</sheetData>` +
			`</worksheet>`,
		),
	);

	zip.writeZip(xlsxPath("test-minimal.xlsx"));
});

after(async () => {
	await rm(TMP_DIR, { recursive: true, force: true });
});

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
			writeFileSync(xlsxPath("test-fake-xlsx.xlsx"), "This is not a real XLSX file");
			const result = await xlsxExtract({ filePath: xlsxPath("test-fake-xlsx.xlsx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, false);
			assert.ok(parsed.error.includes("ZIP extraction failed"));
		});

		it("should extract markdown from a valid XLSX file", async () => {
			const result = await xlsxExtract({ filePath: xlsxPath("test-minimal.xlsx") });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.format, "markdown");
			assert.ok(typeof parsed.content === "string");
		});

		it("should extract JSON from a valid XLSX file", async () => {
			const result = await xlsxExtract({ filePath: xlsxPath("test-minimal.xlsx"), format: "json" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.format, "json");
			assert.ok(typeof parsed.content === "string");
		});
	});
});
