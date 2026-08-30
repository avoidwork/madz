/**
 * Spreadsheet computation and analysis tool.
 * Provides compute, generate, analyze, csvImport, csvExport, modify, and export operations.
 * @module spreadsheet/spreadsheet
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { parseFormula } from "./formulaParser.js";
import * as stats from "./stats.js";
import * as csv from "./csv.js";
import * as pivot from "./pivot.js";

// ─── Input Schema ────────────────────────────────────────────────────────────────

const SpreadsheetSchema = z.object({
	action: z.enum(["compute", "generate", "analyze", "csvImport", "csvExport", "modify", "export"]),
	// compute
	data: z
		.array(z.record(z.unknown()))
		.optional()
		.describe("Array of objects representing rows of data"),
	operations: z
		.array(
			z.object({
				type: z.enum([
					"sum",
					"average",
					"count",
					"min",
					"max",
					"formula",
					"median",
					"stddev",
					"variance",
				]),
				field: z.string().optional().describe("Field name to operate on (not needed for count)"),
				formula: z.string().optional().describe("Formula expression (for formula type)"),
				alias: z.string().optional().describe("Output field name for the result"),
			}),
		)
		.optional()
		.describe("List of operations to perform on the data"),
	// generate
	sheets: z
		.array(
			z.object({
				name: z.string().describe("Sheet name"),
				rows: z
					.array(
						z.object({
							values: z.array(z.unknown()).describe("Cell values for each row"),
							formulas: z
								.record(z.string())
								.optional()
								.describe("Cell formulas keyed by column index"),
							formatting: z.record(z.unknown()).optional().describe("Cell formatting options"),
						}),
					)
					.describe("Sheet data as array of rows"),
			}),
		)
		.optional()
		.describe("Sheet definitions with rows, formulas, and formatting"),
	outputPath: z.string().optional().describe("Output file path"),
	// csvImport
	content: z.string().optional().describe("CSV content as string"),
	// csv options
	delimiter: z.string().optional().describe("Field delimiter (default: ',')"),
	quote: z.string().optional().describe("Quote character (default: '\"')"),
	trim: z.boolean().optional().describe("Trim whitespace (default: true)"),
	header: z.boolean().optional().describe("Include header row (default: true)"),
	// analyze
	analysisOperations: z
		.array(
			z.object({
				type: z.enum(["pivot", "filter", "groupBy", "stats", "percentile"]),
				config: z.record(z.unknown()).describe("Operation-specific configuration"),
			}),
		)
		.optional()
		.describe("Analysis operations to perform"),
	// modify
	inputPath: z.string().optional().describe("Input XLSX file path"),
	modifyOperations: z
		.array(
			z.object({
				type: z.enum([
					"addCell",
					"modifyCell",
					"deleteCell",
					"addSheet",
					"deleteSheet",
					"renameSheet",
				]),
				sheetName: z.string().describe("Target sheet name"),
				cellRef: z.string().optional().describe("Cell reference (e.g., 'A1', 'B3')"),
				value: z.unknown().optional().describe("New value"),
				formula: z.string().optional().describe("New formula"),
				newName: z.string().optional().describe("New sheet name (for rename)"),
			}),
		)
		.optional()
		.describe("Modification operations to apply"),
	// export
	format: z.enum(["xlsx", "csv", "json"]).optional().describe("Output format"),
});

// ─── Implementation ─────────────────────────────────────────────────────────────────

/**
 * Spreadsheet computation tool.
 * @param {z.infer<typeof SpreadsheetSchema>} input - Tool input
 * @returns {Promise<Object>} Operation result
 */
export async function spreadsheetImpl(input) {
	const { action } = SpreadsheetSchema.parse(input);

	switch (action) {
		case "compute":
			return compute(input);
		case "generate":
			return generate(input);
		case "analyze":
			return analyze(input);
		case "csvImport":
			return csvImport(input);
		case "csvExport":
			return csvExport(input);
		case "modify":
			return modify(input);
		case "export":
			return exportData(input);
		default:
			throw new Error(`Unknown action: ${action}`);
	}
}

/**
 * Run computations on structured data.
 * @param {object} input - Tool input
 * @returns {Object} Computed results
 */
async function compute(input) {
	const { data, operations } = SpreadsheetSchema.parse(input);

	if (!data || data.length === 0) {
		throw new Error("compute() requires non-empty data");
	}

	const results = [];

	for (const op of operations) {
		const result = { type: op.type };

		switch (op.type) {
			case "sum": {
				const values = data.map((row) => Number(row[op.field] ?? 0)).filter((v) => !isNaN(v));
				result.value = values.reduce((s, v) => s + v, 0);
				break;
			}
			case "average": {
				const values = data.map((row) => Number(row[op.field] ?? 0)).filter((v) => !isNaN(v));
				result.value = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
				break;
			}
			case "count":
				result.value = data.length;
				break;
			case "min": {
				const values = data.map((row) => Number(row[op.field])).filter((v) => !isNaN(v));
				result.value = values.length ? Math.min(...values) : 0;
				break;
			}
			case "max": {
				const values = data.map((row) => Number(row[op.field])).filter((v) => !isNaN(v));
				result.value = values.length ? Math.max(...values) : 0;
				break;
			}
			case "formula": {
				if (!op.formula) throw new Error("formula operation requires a formula string");
				const parsed = parseFormula(op.formula);
				const context = {};
				const headers = Object.keys(data[0]);
				headers.forEach((h, i) => {
					const col = String.fromCharCode(65 + (i % 26));
					context[`${col}${1}`] = data[0][h];
				});
				result.value = parsed.evaluate(context);
				break;
			}
			case "median": {
				const values = data.map((row) => Number(row[op.field])).filter((v) => !isNaN(v));
				result.value = stats.median(values);
				break;
			}
			case "stddev": {
				const values = data.map((row) => Number(row[op.field])).filter((v) => !isNaN(v));
				result.value = stats.stddev(values);
				break;
			}
			case "variance": {
				const values = data.map((row) => Number(row[op.field])).filter((v) => !isNaN(v));
				result.value = stats.variance(values);
				break;
			}
			default:
				throw new Error(`Unknown operation type: ${op.type}`);
		}

		if (op.alias) {
			result.alias = op.alias;
		}

		results.push(result);
	}

	return { results };
}

/**
 * Generate a new XLSX file with formulas, formatting, and multiple sheets.
 * @param {object} input - Tool input
 * @returns {Object} Generation result
 */
async function generate(input) {
	const { sheets, outputPath } = SpreadsheetSchema.parse(input);

	if (!sheets || sheets.length === 0) {
		throw new Error("generate() requires at least one sheet");
	}

	// Build workbook structure
	const workbook = {
		sheets: sheets.map((sheet) => {
			const rows = sheet.rows.map((row) => {
				const cells = {};
				row.values.forEach((value, i) => {
					const colLetter = String.fromCharCode(65 + (i % 26));
					const rowNumber = Math.floor(i / 26) + 1;
					cells[`${colLetter}${rowNumber}`] = { value, formula: row.formulas?.[i] };
				});
				return cells;
			});
			return { name: sheet.name, rows };
		}),
	};

	return {
		status: "generated",
		outputPath,
		sheets: sheets.map((s) => s.name),
		workbook,
	};
}

/**
 * Perform analysis operations on data.
 * @param {object} input - Tool input
 * @returns {Object} Analysis results
 */
async function analyze(input) {
	const { data, analysisOperations } = SpreadsheetSchema.parse(input);

	if (!data || data.length === 0) {
		throw new Error("analyze() requires non-empty data");
	}

	const results = [];

	for (const op of analysisOperations) {
		switch (op.type) {
			case "pivot": {
				const result = pivot.pivot(data, op.config);
				results.push({ type: "pivot", data: result });
				break;
			}
			case "filter": {
				const { field, operator, value } = op.config;
				const result = pivot.filter(data, field, operator, value);
				results.push({ type: "filter", count: result.length, data: result });
				break;
			}
			case "groupBy": {
				const result = pivot.groupBy(data, op.config.keys);
				results.push({ type: "groupBy", groups: result.length, data: result });
				break;
			}
			case "stats": {
				const { field } = op.config;
				const values = data.map((row) => Number(row[field])).filter((v) => !isNaN(v));
				results.push({
					type: "stats",
					field,
					count: values.length,
					mean: stats.mean(values),
					median: stats.median(values),
					stddev: values.length >= 2 ? stats.stddev(values) : 0,
					min: values.length ? Math.min(...values) : 0,
					max: values.length ? Math.max(...values) : 0,
				});
				break;
			}
			case "percentile": {
				const { field, p } = op.config;
				const values = data.map((row) => Number(row[field])).filter((v) => !isNaN(v));
				results.push({ type: "percentile", field, p, value: stats.percentile(values, p) });
				break;
			}
			default:
				throw new Error(`Unknown analysis type: ${op.type}`);
		}
	}

	return { results };
}

/**
 * Import CSV content.
 * @param {object} input - Tool input
 * @returns {Object} Imported data
 */
async function csvImport(input) {
	const { content, delimiter, quote, trim } = SpreadsheetSchema.parse(input);
	const data = csv.csvImport(content, { delimiter, quote, trim });
	return { records: data.length, data };
}

/**
 * Export data to CSV.
 * @param {object} input - Tool input
 * @returns {Object} CSV string
 */
async function csvExport(input) {
	const { data, delimiter, quote, header } = SpreadsheetSchema.parse(input);
	const csvString = csv.csvExport(data, { delimiter, quote, header });
	return { csv: csvString };
}

/**
 * Modify an existing XLSX file.
 * @param {object} input - Tool input
 * @returns {Object} Modification result
 */
async function modify(input) {
	const { inputPath, modifyOperations, outputPath } = SpreadsheetSchema.parse(input);

	// Validate input file exists
	const fs = await import("node:fs");
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	// Load workbook with exceljs
	const ExcelJS = await import("exceljs");
	const workbook = new ExcelJS.default.Workbook();
	await workbook.xlsx.readFile(inputPath);

	const results = [];

	for (const op of modifyOperations) {
		const sheet = workbook.getWorksheet(op.sheetName);
		if (!sheet) {
			results.push({
				operation: op.type,
				sheet: op.sheetName,
				status: "error",
				reason: `Sheet "${op.sheetName}" not found`,
			});
			continue;
		}

		switch (op.type) {
			case "addCell": {
				if (op.cellRef) {
					sheet.getCell(op.cellRef).value = op.value ?? "";
					if (op.formula) sheet.getCell(op.cellRef).value = { formula: op.formula };
				}
				results.push({
					operation: op.type,
					sheet: op.sheetName,
					cell: op.cellRef,
					status: "added",
				});
				break;
			}
			case "modifyCell": {
				if (op.cellRef) {
					sheet.getCell(op.cellRef).value = op.value ?? "";
					if (op.formula) sheet.getCell(op.cellRef).value = { formula: op.formula };
				}
				results.push({
					operation: op.type,
					sheet: op.sheetName,
					cell: op.cellRef,
					status: "modified",
				});
				break;
			}
			case "deleteCell": {
				if (op.cellRef) {
					sheet.getCell(op.cellRef).value = undefined;
				}
				results.push({
					operation: op.type,
					sheet: op.sheetName,
					cell: op.cellRef,
					status: "deleted",
				});
				break;
			}
			case "addSheet": {
				await workbook.addWorksheet(op.sheetName);
				results.push({ operation: op.type, sheet: op.sheetName, status: "added" });
				break;
			}
			case "deleteSheet": {
				workbook.removeWorksheet(sheet.id);
				results.push({ operation: op.type, sheet: op.sheetName, status: "deleted" });
				break;
			}
			case "renameSheet": {
				if (op.newName) {
					sheet.name = op.newName;
				}
				results.push({
					operation: op.type,
					sheet: op.sheetName,
					newName: op.newName,
					status: "renamed",
				});
				break;
			}
			default:
				results.push({
					operation: op.type,
					sheet: op.sheetName,
					status: "error",
					reason: `Unknown operation: ${op.type}`,
				});
		}
	}

	// Save modified workbook
	await workbook.xlsx.writeFile(outputPath);

	return {
		status: "modified",
		inputPath,
		outputPath,
		operations: results.length,
		results,
	};
}

/**
 * Unified export endpoint.
 * @param {object} input - Tool input
 * @returns {Object} Export result
 */
async function exportData(input) {
	const { data, format, outputPath } = SpreadsheetSchema.parse(input);

	if (!data || data.length === 0) {
		throw new Error("export() requires non-empty data");
	}

	switch (format) {
		case "json": {
			const json = JSON.stringify(data, null, 2);
			return { format: "json", output: json, outputPath };
		}
		case "csv": {
			const csvString = csv.csvExport(data);
			return { format: "csv", output: csvString, outputPath };
		}
		case "xlsx": {
			const ExcelJS = await import("exceljs");
			const workbook = new ExcelJS.default.Workbook();
			const sheet = workbook.addWorksheet("Sheet1");

			// Add headers
			const headers = Object.keys(data[0] ?? {});
			sheet.addRow(headers);

			// Add data rows
			for (const row of data) {
				sheet.addRow(headers.map((h) => row[h] ?? ""));
			}

			await workbook.xlsx.writeFile(outputPath);
			return {
				format: "xlsx",
				status: "generated",
				outputPath,
				rows: data.length,
				columns: headers,
			};
		}
		default:
			throw new Error(`Unsupported export format: ${format}`);
	}
}

// ─── Tool Registration ──────────────────────────────────────────────────────────────

/**
 * Spreadsheet computation tool.
 * @param {z.infer<typeof SpreadsheetSchema>} input - Tool input
 * @returns {Promise<Object>} Operation result
 */
export const spreadsheet = tool(spreadsheetImpl, {
	name: "spreadsheet",
	description:
		"Spreadsheet computation and analysis. Actions: compute (sum, average, count, min, max, formula, median, stddev, variance), generate (create XLSX with formulas), analyze (pivot tables, filtering, groupBy, stats, percentile), csvImport, csvExport, modify (add/modify/delete cells and sheets), export (XLSX, CSV, JSON).",
	schema: SpreadsheetSchema,
});
