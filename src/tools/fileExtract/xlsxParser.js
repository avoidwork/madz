/**
 * XLSX to Markdown parser.
 * Converts Excel spreadsheets to markdown tables.
 * @module fileExtract/xlsxParser
 */

import { extractZipXml } from "./zipExtractor.js";
import { parseStringPromise } from "xml2js";

/**
 * Convert XLSX to markdown tables.
 * @param {Map<string, string>} zipContent - Map of internal path → content
 * @returns {string} Markdown string with tables per sheet
 */
export function xlsxToMarkdown(zipContent) {
	let markdown = "";

	const workbookXml = zipContent.get("xl/workbook.xml");
	if (!workbookXml) return "";

	try {
		const parsed = parseStringPromise(workbookXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const sheets = parsed?.workbook?.[0]?.sheets?.sheet;
		if (!sheets) return "";

		const sheetArray = Array.isArray(sheets) ? sheets : [sheets];

		for (const sheetDef of sheetArray) {
			const sheetName = sheetDef?.$?.name || "Sheet";
			const sheetId = sheetDef?.$?.sheetId || "1";

			// Find the corresponding sheet XML file
			const sheetXml = findSheetXml(zipContent, sheetId);
			if (!sheetXml) continue;

			const table = parseSheetContent(sheetXml);
			if (table && table.rows.length > 0) {
				markdown += `## ${sheetName}\n\n`;
				markdown += toMarkdownTable(table.rows);
				markdown += "\n\n";
			}
		}
	} catch {
		// Silently skip on parse error
	}

	return markdown.trim();
}

/**
 * Find the sheet XML file by sheet ID.
 * @param {Map<string, string>} zipContent - Map of internal path → content
 * @param {string} sheetId - Sheet ID
 * @returns {string | null} Sheet XML content or null
 */
function findSheetXml(zipContent, sheetId) {
	// Try common patterns
	const patterns = [
		`xl/worksheets/sheet${sheetId}.xml`,
		`xl/worksheets/sheet${sheetId}.xml`,
	];

	for (const pattern of patterns) {
		if (zipContent.has(pattern)) {
			return zipContent.get(pattern);
		}
	}

	// Fallback: scan all sheet files
	for (const path of zipContent.keys()) {
		if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
			return zipContent.get(path);
		}
	}

	return null;
}

/**
 * Parse sheet XML content into rows.
 * @param {string} sheetXml - Sheet XML content
 * @returns {{ rows: string[][] } | null} Parsed rows or null
 */
function parseSheetContent(sheetXml) {
	try {
		const parsed = parseStringPromise(sheetXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const sheetData = parsed?.sheet?.[0]?.sheetData?.row;
		if (!sheetData) return null;

		const rowArray = Array.isArray(sheetData) ? sheetData : [sheetData];
		const rows = [];

		for (const row of rowArray) {
			const cells = row?.c || [];
			const cellArray = Array.isArray(cells) ? cells : [cells];
			const rowData = [];

			for (const cell of cellArray) {
				rowData.push(getCellValue(cell));
			}

			rows.push(rowData);
		}

		return { rows };
	} catch {
		return null;
	}
}

/**
 * Get the value of a cell.
 * @param {object} cell - Parsed cell XML object
 * @returns {string} Cell value
 */
function getCellValue(cell) {
	const v = cell?.v;
	if (v !== undefined && v !== null) {
		return String(v);
	}

	// Check for t="inlineStr"
	const t = cell?.$?.t || cell?.t;
	if (t === "inlineStr") {
		const is = cell?.is;
		if (is) {
			const tEl = is?.t || is?.["t"];
			return tEl || "";
		}
	}

	return "";
}

/**
 * Convert rows to markdown table format.
 * @param {string[][]} rows - 2D array of cell values
 * @returns {string} Markdown table
 */
function toMarkdownTable(rows) {
	if (rows.length === 0) return "";

	const maxCols = Math.max(...rows.map((r) => r.length));
	const normalizedRows = rows.map((r) => {
		while (r.length < maxCols) r.push("");
		return r;
	});

	let table = "";

	// Header row
	table += "| " + normalizedRows[0].join(" | ") + " |\n";
	table += "| " + normalizedRows[0].map(() => "---").join(" | ") + " |\n";

	// Data rows
	for (let i = 1; i < normalizedRows.length; i++) {
		table += "| " + normalizedRows[i].join(" | ") + " |\n";
	}

	return table;
}
