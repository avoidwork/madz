/**
 * Tests for the main spreadsheet tool.
 * @see {@link src/tools/spreadsheet/spreadsheet.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	spreadsheetCompute,
	spreadsheetGenerate,
	spreadsheetAnalyze,
	spreadsheetCsvImport,
	spreadsheetCsvExport,
	spreadsheetModify,
	spreadsheetExport,
} from "../../../src/tools/spreadsheet/spreadsheet.js";

describe("spreadsheet", () => {
	describe("spreadsheetCompute", () => {
		it("should compute sum of values", async () => {
			const result = await spreadsheetCompute({
				operation: "sum",
				values: [1, 2, 3, 4, 5],
			});
			assert.strictEqual(result, 15);
		});

		it("should compute average of values", async () => {
			const result = await spreadsheetCompute({
				operation: "average",
				values: [10, 20, 30],
			});
			assert.strictEqual(result, 20);
		});

		it("should compute count of values", async () => {
			const result = await spreadsheetCompute({
				operation: "count",
				values: [1, 2, 3, 4, 5],
			});
			assert.strictEqual(result, 5);
		});

		it("should compute min of values", async () => {
			const result = await spreadsheetCompute({
				operation: "min",
				values: [10, 5, 20, 1],
			});
			assert.strictEqual(result, 1);
		});

		it("should compute max of values", async () => {
			const result = await spreadsheetCompute({
				operation: "max",
				values: [10, 5, 20, 1],
			});
			assert.strictEqual(result, 20);
		});

		it("should compute median of values", async () => {
			const result = await spreadsheetCompute({
				operation: "median",
				values: [1, 3, 5],
			});
			assert.strictEqual(result, 3);
		});

		it("should compute stddev of values", async () => {
			const result = await spreadsheetCompute({
				operation: "stddev",
				values: [2, 4, 4, 4, 5, 5, 7, 9],
			});
			assert.ok(Math.abs(result - 2) < 0.01);
		});

		it("should evaluate a formula", async () => {
			const result = await spreadsheetCompute({
				operation: "formula",
				formula: "=A1+B2",
				cells: { A1: 10, B2: 20 },
			});
			assert.strictEqual(result, 30);
		});

		it("should handle empty values", async () => {
			const result = await spreadsheetCompute({
				operation: "sum",
				values: [],
			});
			assert.strictEqual(result, 0);
		});

		it("should throw on invalid operation", async () => {
			await assert.rejects(
				() => spreadsheetCompute({ operation: "invalid", values: [1, 2, 3] }),
				/invalid operation/,
			);
		});
	});

	describe("spreadsheetGenerate", () => {
		it("should generate a simple spreadsheet", async () => {
			const result = await spreadsheetGenerate({
				sheets: [
					{
						name: "Sheet1",
						data: [
							{ A: 1, B: 2 },
							{ A: 3, B: 4 },
						],
					},
				],
			});
			assert.ok(result.path);
			assert.ok(result.path.endsWith(".xlsx"));
		});

		it("should generate a spreadsheet with formulas", async () => {
			const result = await spreadsheetGenerate({
				sheets: [
					{
						name: "Sheet1",
						data: [{ A: 1, B: 2, C: "=A1+B1" }],
					},
				],
			});
			assert.ok(result.path);
			assert.ok(result.path.endsWith(".xlsx"));
		});

		it("should generate a multi-sheet spreadsheet", async () => {
			const result = await spreadsheetGenerate({
				sheets: [
					{
						name: "Sheet1",
						data: [{ A: 1 }],
					},
					{
						name: "Sheet2",
						data: [{ B: 2 }],
					},
				],
			});
			assert.ok(result.path);
			assert.strictEqual(result.sheets, 2);
		});
	});

	describe("spreadsheetAnalyze", () => {
		it("should perform a pivot table", async () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
				{ region: "South", product: "B", sales: 250 },
			];
			const result = await spreadsheetAnalyze({
				data,
				operation: "pivot",
				keys: ["region"],
				value: "sales",
				aggregation: "sum",
			});
			assert.ok(Array.isArray(result));
			assert.ok(result.length > 0);
		});

		it("should filter data", async () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = await spreadsheetAnalyze({
				data,
				operation: "filter",
				field: "region",
				condition: "==",
				value: "North",
			});
			assert.strictEqual(result.length, 2);
		});

		it("should compute statistics", async () => {
			const data = [10, 20, 30, 40, 50];
			const result = await spreadsheetAnalyze({
				data,
				operation: "stats",
				values: data,
			});
			assert.ok(result.mean);
			assert.ok(result.median);
			assert.ok(result.stddev);
		});
	});

	describe("spreadsheetCsvImport", () => {
		it("should import a CSV string", async () => {
			const csvData = "name,age\nAlice,30\nBob,25";
			const result = await spreadsheetCsvImport({ content: csvData });
			assert.strictEqual(result.length, 2);
		});

		it("should import a CSV file", async () => {
			// This would require a real file, so we test with content
			const result = await spreadsheetCsvImport({ content: "a,b\n1,2" });
			assert.strictEqual(result.length, 1);
		});
	});

	describe("spreadsheetCsvExport", () => {
		it("should export data to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheetCsvExport({ data });
			assert.ok(typeof result.content === "string");
			assert.ok(result.content.includes("name,age"));
		});

		it("should export with custom delimiter", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheetCsvExport({ data, delimiter: ";" });
			assert.ok(result.content.includes("name;age"));
		});
	});

	describe("spreadsheetModify", () => {
		it("should modify an existing spreadsheet", async () => {
			const result = await spreadsheetModify({
				path: "/tmp/test.xlsx",
				changes: {
					cells: [{ sheet: "Sheet1", ref: "A1", value: 42 }],
				},
			});
			assert.ok(result.modified);
		});
	});

	describe("spreadsheetExport", () => {
		it("should export to XLSX", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheetExport({ data, format: "xlsx" });
			assert.ok(result.path);
			assert.ok(result.path.endsWith(".xlsx"));
		});

		it("should export to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheetExport({ data, format: "csv" });
			assert.ok(result.content);
			assert.ok(result.content.includes("name,age"));
		});

		it("should export to JSON", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheetExport({ data, format: "json" });
			assert.ok(result.content);
			assert.ok(result.content.includes("Alice"));
		});
	});
});
