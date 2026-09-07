/**
 * Tests for the XLSX to Markdown parser.
 * @see {@link src/tools/fileExtract/xlsxParser.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { xlsxToMarkdown } from "../../../../src/tools/fileExtract/xlsxParser.js";

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

function workbookXml(sheets) {
	return `<?xml version="1.0"?><workbook ${NS}><sheets>${sheets}</sheets></workbook>`;
}

function sheetDef(name, id) {
	return `<sheet name="${name}" sheetId="${id}"/>`;
}

function sheetXml(rows, mergeCells) {
	const mc = mergeCells ? `<mergeCells>${mergeCells}</mergeCells>` : "";
	return `<?xml version="1.0"?><worksheet ${NS}>${mc}<sheetData>${rows}</sheetData></worksheet>`;
}

function row(r, ...cells) {
	return `<row r="${r}">${cells.join("")}</row>`;
}

function cell(ref, type, value) {
	if (type === "inlineStr") {
		return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
	}
	const tAttr = type ? ` t="${type}"` : "";
	return `<c r="${ref}"${tAttr}><v>${value}</v></c>`;
}

function mergeCell(ref) {
	return `<mergeCell ref="${ref}"/>`;
}

describe("xlsxToMarkdown", () => {
	it("should throw TypeError for null input", async () => {
		await assert.rejects(() => xlsxToMarkdown(null), TypeError);
	});

	it("should return empty string for empty Map", async () => {
		assert.strictEqual(await xlsxToMarkdown(new Map()), "");
	});

	it("should return empty string when no workbook.xml", async () => {
		const zip = new Map();
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "data"))));
		assert.strictEqual(await xlsxToMarkdown(zip), "");
	});

	it("should parse a single sheet into markdown table", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "", "Name"), cell("B1", "", "Age")) +
			row(2, cell("A2", "", "Alice"), cell("B2", "", "30"))
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("## Sheet1"));
		assert.ok(result.includes("| Name | Age |"));
		assert.ok(result.includes("| Alice | 30 |"));
	});

	it("should parse multiple sheets with headers", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1") + sheetDef("Sheet2", "2")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "A"))));
		zip.set("xl/worksheets/sheet2.xml", sheetXml(row(1, cell("A1", "", "B"))));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("## Sheet1"));
		assert.ok(result.includes("## Sheet2"));
	});

	it("should skip empty sheet (no rows)", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1") + sheetDef("Sheet2", "2")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "Data"))));
		zip.set("xl/worksheets/sheet2.xml", `<?xml version="1.0"?><worksheet ${NS}><sheetData></sheetData></worksheet>`);
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("## Sheet1"));
		assert.ok(!result.includes("## Sheet2"));
	});

	it("should handle inlineStr cells", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "inlineStr", "Hello"))
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("Hello"));
	});

	it("should handle merged cells (empty in non-primary positions)", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "", "Merged"), cell("B1", "", "")),
			row(2, cell("A2", "", ""), cell("B2", "", "")),
			mergeCell("A1:B2")
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("Merged"));
	});

	it("should handle malformed XML", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", "<broken>");
		assert.strictEqual(await xlsxToMarkdown(zip), "");
	});

	it("should skip sheet without matching XML", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1") + sheetDef("Sheet2", "2")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "Data"))));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("## Sheet1"));
		assert.ok(!result.includes("## Sheet2"));
	});

	it("should handle cell with no value and no inlineStr", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, `<c r="A1"></c>`)));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("|  |"));
	});

	it("should handle sheet with sheetData but no rows", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet ${NS}><sheetData></sheetData></worksheet>`);
		const result = await xlsxToMarkdown(zip);
		assert.strictEqual(result, "");
	});

	it("should handle findSheetXml fallback scan", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "99")));
		zip.set("xl/worksheets/sheet99.xml", sheetXml(row(1, cell("A1", "", "Fallback"))));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("Fallback"));
	});

	it("should handle mergeCell with $ wrapper", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "", "A"), cell("B1", "", "B")),
			`<mergeCells><mergeCell ref="A1:B1"/></mergeCells>`
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("A"));
	});

	it("should handle mergeCell with invalid ref", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "", "A")),
			`<mergeCells><mergeCell ref="invalid"/></mergeCells>`
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("A"));
	});

	it("should handle cell with v=0 (falsy value)", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "0"))));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("0"));
	});

	it("should handle irregular row lengths", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(
			row(1, cell("A1", "", "A"), cell("B1", "", "B"), cell("C1", "", "C")) +
			row(2, cell("A2", "", "short"))
		));
		const result = await xlsxToMarkdown(zip);
		assert.ok(result.includes("A"));
		assert.ok(result.includes("short"));
	});
});
