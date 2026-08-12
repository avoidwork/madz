/**
 * XLSX to JSON converter.
 * Converts Excel spreadsheets to structured JSON.
 * @module fileExtract/xlsxJson
 */

import { parseStringPromise } from "xml2js";

/**
 * Convert XLSX to JSON object with sheet names as keys.
 * @param {Map<string, string>} zipContent - Map of internal path → content
 * @returns {object} JSON object with sheet data
 */
export function xlsxToJson(zipContent) {
	const result = {};

	const workbookXml = zipContent.get("xl/workbook.xml");
	if (!workbookXml) return result;

	try {
		const parsed = parseStringPromise(workbookXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const sheets = parsed?.workbook?.[0]?.sheets?.sheet;
		if (!sheets) return result;

		const sheetArray = Array.isArray(sheets) ? sheets : [sheets];

		for (const sheetDef of sheetArray) {
			const sheetName = sheetDef?.$?.name || "Sheet";
			const sheetId = sheetDef?.$?.sheetId || "1";

			const sheetXml = findSheetXml(zipContent, sheetId);
			if (!sheetXml) continue;

			const rows = parseSheetRows(sheetXml);
			result[sheetName] = rows;
		}
	} catch (_err) {
		// Silently skip on parse error
	}

	return result;
}

/**
 * Find the sheet XML file by sheet ID.
 * @param {Map<string, string>} zipContent - Map of internal path → content
 * @param {string} sheetId - Sheet ID
 * @returns {string | null}
 */
function findSheetXml(zipContent, sheetId) {
	const patterns = [`xl/worksheets/sheet${sheetId}.xml`];

	for (const pattern of patterns) {
		if (zipContent.has(pattern)) {
			return zipContent.get(pattern);
		}
	}

	for (const path of zipContent.keys()) {
		if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
			return zipContent.get(path);
		}
	}

	return null;
}

/**
 * Parse sheet XML into array of row objects.
 * @param {string} sheetXml - Sheet XML content
 * @returns {object[]} Array of row objects
 */
function parseSheetRows(sheetXml) {
	try {
		const parsed = parseStringPromise(sheetXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const sheetData = parsed?.sheet?.[0]?.sheetData?.row;
		if (!sheetData) return [];

		const rowArray = Array.isArray(sheetData) ? sheetData : [sheetData];
		const rows = [];

		for (const row of rowArray) {
			const cells = row?.c || [];
			const cellArray = Array.isArray(cells) ? cells : [cells];
			const rowData = {};

			for (const cell of cellArray) {
				const ref = cell?.$?.r;
				if (ref) {
					rowData[ref] = getCellValue(cell);
				}
			}

			rows.push(rowData);
		}

		return rows;
	} catch {
		return [];
	}
}

/**
 * Get the value of a cell.
 * @param {object} cell - Parsed cell XML object
 * @returns {string | number | boolean} Cell value with type preservation
 */
function getCellValue(cell) {
	const v = cell?.v;
	if (v === undefined || v === null) return "";

	const strVal = String(v);

	// Check type
	const t = cell?.$?.t || cell?.t;
	if (t === "b") {
		return strVal === "1" ? true : false;
	}
	if (t === "n") {
		const num = Number(strVal);
		return isNaN(num) ? strVal : num;
	}

	return strVal;
}
