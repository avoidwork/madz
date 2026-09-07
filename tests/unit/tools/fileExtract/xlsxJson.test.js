/**
 * Tests for the XLSX to JSON converter.
 * @see {@link src/tools/fileExtract/xlsxJson.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { xlsxToJson } from "../../../../src/tools/fileExtract/xlsxJson.js";

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

function workbookXml(sheets) {
	return `<?xml version="1.0"?><workbook ${NS}><sheets>${sheets}</sheets></workbook>`;
}

function sheetDef(name, id) {
	return `<sheet name="${name}" sheetId="${id}"/>`;
}

function sheetXml(rows) {
	return `<?xml version="1.0"?><worksheet ${NS}><sheetData>${rows}</sheetData></worksheet>`;
}

function row(r, ...cells) {
	return `<row r="${r}">${cells.join("")}</row>`;
}

function cell(ref, type, value) {
	const tAttr = type ? ` t="${type}"` : "";
	return `<c r="${ref}"${tAttr}><v>${value}</v></c>`;
}

describe("xlsxToJson", () => {
	it("should throw TypeError for null input", async () => {
		await assert.rejects(() => xlsxToJson(null), TypeError);
	});

	it("should return empty object for empty Map", async () => {
		assert.deepStrictEqual(await xlsxToJson(new Map()), {});
	});

	it("should return empty object when no workbook.xml", async () => {
		const zip = new Map();
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "n", "42"))));
		assert.deepStrictEqual(await xlsxToJson(zip), {});
	});

	it("should parse a single sheet with data", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set(
			"xl/worksheets/sheet1.xml",
			sheetXml(
				row(1, cell("A1", "", "Name"), cell("B1", "", "Age")) +
					row(2, cell("A2", "", "Alice"), cell("B2", "n", "30")),
			),
		);
		const result = await xlsxToJson(zip);
		assert.deepStrictEqual(result, {
			Sheet1: [
				{ A1: "Name", B1: "Age" },
				{ A2: "Alice", B2: 30 },
			],
		});
	});

	it("should parse multiple sheets", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1") + sheetDef("Sheet2", "2")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "A"))));
		zip.set("xl/worksheets/sheet2.xml", sheetXml(row(1, cell("A1", "", "B"))));
		const result = await xlsxToJson(zip);
		assert.deepStrictEqual(result, {
			Sheet1: [{ A1: "A" }],
			Sheet2: [{ A1: "B" }],
		});
	});

	it("should preserve boolean cell type", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set(
			"xl/worksheets/sheet1.xml",
			sheetXml(row(1, cell("A1", "b", "1")) + row(2, cell("A2", "b", "0"))),
		);
		const result = await xlsxToJson(zip);
		assert.strictEqual(result.Sheet1[0].A1, true);
		assert.strictEqual(result.Sheet1[1].A2, false);
	});

	it("should preserve number cell type", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "n", "42.5"))));
		const result = await xlsxToJson(zip);
		assert.strictEqual(result.Sheet1[0].A1, 42.5);
	});

	it("should handle non-numeric number type as string", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "n", "N/A"))));
		const result = await xlsxToJson(zip);
		assert.strictEqual(result.Sheet1[0].A1, "N/A");
	});

	it("should return empty string for empty cell", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, `<c r="A1"></c>`)));
		const result = await xlsxToJson(zip);
		assert.strictEqual(result.Sheet1[0].A1, "");
	});

	it("should handle malformed workbook XML", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", "<broken>");
		assert.deepStrictEqual(await xlsxToJson(zip), {});
	});

	it("should skip sheet without matching XML file", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1") + sheetDef("Sheet2", "2")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, cell("A1", "", "Data"))));
		const result = await xlsxToJson(zip);
		assert.deepStrictEqual(result, { Sheet1: [{ A1: "Data" }] });
	});

	it("should handle empty sheet (no sheetData)", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet ${NS}></worksheet>`);
		const result = await xlsxToJson(zip);
		assert.deepStrictEqual(result, { Sheet1: [] });
	});

	it("should handle cell with no ref", async () => {
		const zip = new Map();
		zip.set("xl/workbook.xml", workbookXml(sheetDef("Sheet1", "1")));
		zip.set("xl/worksheets/sheet1.xml", sheetXml(row(1, `<c><v>orphan</v></c>`)));
		const result = await xlsxToJson(zip);
		assert.deepStrictEqual(result, { Sheet1: [{}] });
	});
});
