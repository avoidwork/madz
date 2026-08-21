/**
 * Tests for the spreadsheet tool.
 * @see {@link src/tools/spreadsheet/spreadsheet.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { spreadsheet } from "../../../src/tools/spreadsheet/spreadsheet.js";

describe("spreadsheet", () => {
	describe("compute", () => {
		it("should compute sum of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ price: 10 }, { price: 20 }, { price: 30 }],
				operations: [{ type: "sum", field: "price" }],
			});
			assert.strictEqual(result.results[0].value, 60);
		});

		it("should compute average of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ val: 10 }, { val: 20 }, { val: 30 }],
				operations: [{ type: "average", field: "val" }],
			});
			assert.strictEqual(result.results[0].value, 20);
		});

		it("should compute count of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ a: 1 }, { a: 2 }, { a: 3 }],
				operations: [{ type: "count" }],
			});
			assert.strictEqual(result.results[0].value, 3);
		});

		it("should compute min of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 5 }, { v: 20 }, { v: 1 }],
				operations: [{ type: "min", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 1);
		});

		it("should compute max of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 5 }, { v: 20 }, { v: 1 }],
				operations: [{ type: "max", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 20);
		});

		it("should compute median of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ v: 1 }, { v: 3 }, { v: 5 }],
				operations: [{ type: "median", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 3);
		});

		it("should compute stddev of values", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }],
				operations: [{ type: "stddev", field: "v" }],
			});
			assert.ok(Math.abs(result.results[0].value - 2) < 0.01);
		});

		it("should evaluate a formula", async () => {
			const result = await spreadsheet({
				action: "compute",
				data: [{ col1: 10, col2: 20 }],
				operations: [{ type: "formula", formula: "=A1+B1" }],
			});
			assert.strictEqual(result.results[0].value, 30);
		});

		it("should handle empty data", async () => {
			await assert.rejects(
				() =>
					spreadsheet({
						action: "compute",
						data: [],
						operations: [{ type: "sum", field: "x" }],
					}),
				/requires non-empty data/,
			);
		});
	});

	describe("generate", () => {
		it("should generate a simple spreadsheet", async () => {
			const result = await spreadsheet({
				action: "generate",
				sheets: [
					{
						name: "Sheet1",
						rows: [{ values: [1, 2] }, { values: [3, 4] }],
					},
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
			assert.ok(result.sheets.includes("Sheet1"));
		});

		it("should generate a multi-sheet spreadsheet", async () => {
			const result = await spreadsheet({
				action: "generate",
				sheets: [
					{ name: "Sheet1", rows: [{ values: [1] }] },
					{ name: "Sheet2", rows: [{ values: [2] }] },
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.sheets.length, 2);
		});
	});

	describe("analyze", () => {
		it("should perform a pivot table", async () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
				{ region: "South", product: "B", sales: 250 },
			];
			const result = await spreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "pivot",
						config: { keys: "region", value: "sales", aggregate: "sum" },
					},
				],
			});
			assert.ok(Array.isArray(result.results));
			assert.ok(result.results[0].data.length > 0);
		});

		it("should filter data", async () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = await spreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "filter",
						config: { field: "region", operator: "eq", value: "North" },
					},
				],
			});
			assert.strictEqual(result.results[0].count, 2);
		});

		it("should compute statistics", async () => {
			const data = [{ val: 10 }, { val: 20 }, { val: 30 }, { val: 40 }, { val: 50 }];
			const result = await spreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "stats",
						config: { field: "val" },
					},
				],
			});
			assert.ok(result.results[0].data.mean);
			assert.ok(result.results[0].data.median);
			assert.ok(result.results[0].data.stddev);
		});
	});

	describe("csvImport", () => {
		it("should import a CSV string", async () => {
			const csvData = "name,age\nAlice,30\nBob,25";
			const result = await spreadsheet({
				action: "csvImport",
				content: csvData,
			});
			assert.strictEqual(result.records, 2);
		});

		it("should import with custom delimiter", async () => {
			const csvData = "name;age\nAlice;30";
			const result = await spreadsheet({
				action: "csvImport",
				content: csvData,
				delimiter: ";",
			});
			assert.strictEqual(result.records, 1);
		});
	});

	describe("csvExport", () => {
		it("should export data to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheet({
				action: "csvExport",
				data,
			});
			assert.ok(typeof result.csv === "string");
			assert.ok(result.csv.includes("name,age"));
		});

		it("should export with custom delimiter", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheet({
				action: "csvExport",
				data,
				delimiter: ";",
			});
			assert.ok(result.csv.includes("name;age"));
		});
	});

	describe("modify", () => {
		it("should modify an existing spreadsheet", async () => {
			// Create a temp xlsx first
			const ExcelJS = await import("exceljs");
			const wb = new ExcelJS.Workbook();
			const ws = wb.addWorksheet("Sheet1");
			ws.getCell("A1").value = 1;
			const tmpPath = "/tmp/modify-test.xlsx";
			await wb.xlsx.writeFile(tmpPath);

			const result = await spreadsheet({
				action: "modify",
				inputPath: tmpPath,
				modifyOperations: [{ type: "modifyCell", sheetName: "Sheet1", cellRef: "A1", value: 42 }],
				outputPath: "/tmp/modify-out.xlsx",
			});
			assert.strictEqual(result.status, "modified");
			assert.strictEqual(result.operations, 1);
		});
	});

	describe("export", () => {
		it("should export to JSON", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheet({
				action: "export",
				data,
				format: "json",
				outputPath: "/tmp/test.json",
			});
			assert.ok(result.output.includes("Alice"));
		});

		it("should export to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheet({
				action: "export",
				data,
				format: "csv",
				outputPath: "/tmp/test.csv",
			});
			assert.ok(result.output.includes("name,age"));
		});

		it("should export to XLSX", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await spreadsheet({
				action: "export",
				data,
				format: "xlsx",
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
			assert.strictEqual(result.rows, 1);
		});
	});
});
