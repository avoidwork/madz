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

// ─── Input Schemas ────────────────────────────────────────────────────────────────

const ComputeSchema = z.object({
	data: z.array(z.record(z.unknown())).describe("Array of objects representing rows of data"),
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
		.describe("List of operations to perform on the data"),
});

const GenerateSchema = z.object({
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
		.describe("Sheet definitions with rows, formulas, and formatting"),
	outputPath: z.string().describe("Output file path (.xlsx)"),
});

const AnalyzeSchema = z.object({
	data: z.array(z.record(z.unknown())).describe("Array of objects representing rows of data"),
	operations: z
		.array(
			z.object({
				type: z.enum(["pivot", "filter", "groupBy", "stats", "percentile"]),
				config: z.record(z.unknown()).describe("Operation-specific configuration"),
			}),
		)
		.describe("Analysis operations to perform"),
});

const CsvImportSchema = z.object({
	content: z.string().describe("CSV content as string"),
	options: z
		.object({
			delimiter: z.string().optional().describe("Field delimiter (default: ',')"),
			quote: z.string().optional().describe("Quote character (default: '\"')"),
			trim: z.boolean().optional().describe("Trim whitespace (default: true)"),
		})
		.optional()
		.describe("CSV parsing options"),
});

const CsvExportSchema = z.object({
	data: z.array(z.record(z.unknown())).describe("Array of objects to export"),
	options: z
		.object({
			delimiter: z.string().optional().describe("Field delimiter (default: ',')"),
			quote: z.string().optional().describe("Quote character (default: '\"')"),
			header: z.boolean().optional().describe("Include header row (default: true)"),
		})
		.optional()
		.describe("CSV output options"),
});

const ModifySchema = z.object({
	inputPath: z.string().describe("Input XLSX file path"),
	operations: z
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
		.describe("Modification operations to apply"),
	outputPath: z.string().describe("Output file path"),
});

const ExportSchema = z.object({
	data: z.array(z.record(z.unknown())).describe("Array of objects representing rows"),
	format: z.enum(["xlsx", "csv", "json"]).describe("Output format"),
	outputPath: z.string().describe("Output file path"),
	options: z.record(z.unknown()).optional().describe("Format-specific options"),
});

// ─── Implementation ─────────────────────────────────────────────────────────────────

/**
 * Run computations on structured data.
 * @param {z.infer<typeof ComputeSchema>} input - Tool input
 * @returns {Object} Computed results
 */
export async function compute(input) {
	const { data, operations } = ComputeSchema.parse(input);

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
				// Build context from first row
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
 * @param {z.infer<typeof GenerateSchema>} input - Tool input
 * @returns {Object} Generation result
 */
export async function generate(input) {
	const { sheets, outputPath } = GenerateSchema.parse(input);

	if (!sheets || sheets.length === 0) {
		throw new Error("generate() requires at least one sheet");
	}

	// Build workbook structure
	const workbook = {
		sheets: sheets.map((sheet) => {
			const rows = sheet.rows.map((row) => {
				const cells = {};
				row.values.forEach((value, i) => {
					// Use column letter + row number
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
 * @param {z.infer<typeof AnalyzeSchema>} input - Tool input
 * @returns {Object} Analysis results
 */
export async function analyze(input) {
	const { data, operations } = AnalyzeSchema.parse(input);

	if (!data || data.length === 0) {
		throw new Error("analyze() requires non-empty data");
	}

	const results = [];

	for (const op of operations) {
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
 * @param {z.infer<typeof CsvImportSchema>} input - Tool input
 * @returns {Object} Imported data
 */
export async function csvImport(input) {
	const { content, options } = CsvImportSchema.parse(input);
	const data = csv.csvImport(content, options);
	return { records: data.length, data };
}

/**
 * Export data to CSV.
 * @param {z.infer<typeof CsvExportSchema>} input - Tool input
 * @returns {Object} CSV string
 */
export async function csvExport(input) {
	const { data, options } = CsvExportSchema.parse(input);
	const csvString = csv.csvExport(data, options);
	return { csv: csvString };
}

/**
 * Modify an existing XLSX file.
 * @param {z.infer<typeof ModifySchema>} input - Tool input
 * @returns {Object} Modification result
 */
export async function modify(input) {
	const { inputPath, operations, outputPath } = ModifySchema.parse(input);

	// Validate input file exists
	const fs = await import("node:fs");
	if (!fs.existsSync(inputPath)) {
		throw new Error(`Input file not found: ${inputPath}`);
	}

	// Load workbook with exceljs
	const ExcelJS = await import("exceljs");
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(inputPath);

	const results = [];

	for (const op of operations) {
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
 * @param {z.infer<typeof ExportSchema>} input - Tool input
 * @returns {Object} Export result
 */
export async function exportData(input) {
	const { data, format, outputPath, options } = ExportSchema.parse(input);

	if (!data || data.length === 0) {
		throw new Error("export() requires non-empty data");
	}

	switch (format) {
		case "json": {
			const json = JSON.stringify(data, null, 2);
			return { format: "json", output: json, outputPath };
		}
		case "csv": {
			const csvString = csv.csvExport(data, options);
			return { format: "csv", output: csvString, outputPath };
		}
		case "xlsx": {
			const ExcelJS = await import("exceljs");
			const workbook = new ExcelJS.Workbook();
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
 * @param {z.infer<typeof ComputeSchema>} input - Tool input
 * @returns {Promise<Object>} Computed results
 */
export const spreadsheetCompute = tool(compute, {
	name: "spreadsheetCompute",
	description:
		"Run computations on structured data. Supports sum, average, count, min, max, formula, median, stddev, and variance operations.",
	schema: ComputeSchema,
});

/**
 * Spreadsheet generation tool.
 * @param {z.infer<typeof GenerateSchema>} input - Tool input
 * @returns {Promise<Object>} Generation result
 */
export const spreadsheetGenerate = tool(generate, {
	name: "spreadsheetGenerate",
	description:
		"Create new XLSX files with formulas, formatting, and multiple sheets. Define sheets with rows, cell formulas, and formatting options.",
	schema: GenerateSchema,
});

/**
 * Spreadsheet analysis tool.
 * @param {z.infer<typeof AnalyzeSchema>} input - Tool input
 * @returns {Promise<Object>} Analysis results
 */
export const spreadsheetAnalyze = tool(analyze, {
	name: "spreadsheetAnalyze",
	description:
		"Perform data analysis: pivot tables, filtering, groupBy, statistics, and percentile calculations on structured data.",
	schema: AnalyzeSchema,
});

/**
 * CSV import tool.
 * @param {z.infer<typeof CsvImportSchema>} input - Tool input
 * @returns {Promise<Object>} Imported records
 */
export const spreadsheetCsvImport = tool(csvImport, {
	name: "spreadsheetCsvImport",
	description:
		"Import CSV content into structured data. Supports configurable delimiters, quoting, and encoding options.",
	schema: CsvImportSchema,
});

/**
 * CSV export tool.
 * @param {z.infer<typeof CsvExportSchema>} input - Tool input
 * @returns {Promise<Object>} CSV string output
 */
export const spreadsheetCsvExport = tool(csvExport, {
	name: "spreadsheetCsvExport",
	description:
		"Export structured data to CSV format. Supports configurable delimiters, quoting, and header options.",
	schema: CsvExportSchema,
});

/**
 * Spreadsheet modification tool.
 * @param {z.infer<typeof ModifySchema>} input - Tool input
 * @returns {Promise<Object>} Modification result
 */
export const spreadsheetModify = tool(modify, {
	name: "spreadsheetModify",
	description: "Modify an existing XLSX file: add/modify/delete cells, add/delete/rename sheets.",
	schema: ModifySchema,
});

/**
 * Unified export tool.
 * @param {z.infer<typeof ExportSchema>} input - Tool input
 * @returns {Promise<Object>} Export result
 */
export const spreadsheetExport = tool(exportData, {
	name: "spreadsheetExport",
	description:
		"Export structured data to XLSX, CSV, or JSON format. Unified endpoint for all export operations.",
	schema: ExportSchema,
});
