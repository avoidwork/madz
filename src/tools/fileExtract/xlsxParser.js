/**
 * XLSX to Markdown parser.
 * Converts Excel spreadsheets to markdown tables.
 * @module fileExtract/xlsxParser
 */

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
	} catch (_err) {
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
	const patterns = [`xl/worksheets/sheet${sheetId}.xml`, `xl/worksheets/sheet${sheetId}.xml`];

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

		// First pass: collect merged cell ranges
		const mergedCells = parsed?.sheet?.[0]?.mergeCells?.mergeCell;
		const mergedMap = new Map();
		if (mergedCells) {
			const mergedArray = Array.isArray(mergedCells) ? mergedCells : [mergedCells];
			for (const mc of mergedArray) {
				const ref = mc?.$?.ref || mc?.ref;
				if (!ref) continue;
				const match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
				if (!match) continue;
				const [, col1, row1, col2, row2] = match;
				const startCol = colToNum(col1);
				const startRow = parseInt(row1, 10);
				const endCol = colToNum(col2);
				const endRow = parseInt(row2, 10);
				for (let r = startRow; r <= endRow; r++) {
					for (let c = startCol; c <= endCol; c++) {
						if (r !== startRow || c !== startCol) {
							mergedMap.set(`${r},${c}`, true);
						}
					}
				}
			}
		}

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

		// Second pass: fill merged cell positions with empty strings
		for (const [key] of mergedMap) {
			const [rowIdx, colIdx] = key.split(",").map(Number);
			if (rowIdx <= rows.length) {
				while (rows[rowIdx - 1].length <= colIdx - 1) {
					rows[rowIdx - 1].push("");
				}
				rows[rowIdx - 1][colIdx - 1] = "";
			}
		}

		return { rows };
	} catch {
		return null;
	}
}

/**
 * Convert Excel column letters to number (A=1, B=2, ..., Z=26, AA=27).
 * @param {string} col - Column letters
 * @returns {number}
 */
function colToNum(col) {
	let num = 0;
	for (let i = 0; i < col.length; i++) {
		num = num * 26 + (col.charCodeAt(i) - 64);
	}
	return num;
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
			const tEl = is?.t;
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
