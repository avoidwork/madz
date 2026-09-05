/**
 * Tests for the spreadsheet tool.
 * @see {@link src/tools/spreadsheet/spreadsheet.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { spreadsheet } from "../../../../src/tools/spreadsheet/spreadsheet.js";

const callSpreadsheet = (input) => spreadsheet.invoke(input);

describe("spreadsheet", () => {
	describe("compute", () => {
		it("should compute sum of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ price: 10 }, { price: 20 }, { price: 30 }],
				operations: [{ type: "sum", field: "price" }],
			});
			assert.strictEqual(result.results[0].value, 60);
		});

		it("should compute average of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ val: 10 }, { val: 20 }, { val: 30 }],
				operations: [{ type: "average", field: "val" }],
			});
			assert.strictEqual(result.results[0].value, 20);
		});

		it("should compute count of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ a: 1 }, { a: 2 }, { a: 3 }],
				operations: [{ type: "count" }],
			});
			assert.strictEqual(result.results[0].value, 3);
		});

		it("should compute min of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 5 }, { v: 20 }, { v: 1 }],
				operations: [{ type: "min", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 1);
		});

		it("should compute max of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 5 }, { v: 20 }, { v: 1 }],
				operations: [{ type: "max", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 20);
		});

		it("should compute median of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 1 }, { v: 3 }, { v: 5 }],
				operations: [{ type: "median", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 3);
		});

		it("should compute stddev of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }],
				operations: [{ type: "stddev", field: "v" }],
			});
			assert.ok(Math.abs(result.results[0].value - 2.138) < 0.01);
		});

		it("should compute variance of values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }],
				operations: [{ type: "variance", field: "v" }],
			});
			assert.ok(Math.abs(result.results[0].value - 4.571) < 0.01);
		});

		it("should evaluate a formula", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ col1: 10, col2: 20 }],
				operations: [{ type: "formula", formula: "=A1+B1" }],
			});
			assert.strictEqual(result.results[0].value, 30);
		});

		it("should handle empty data", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "compute",
						data: [],
						operations: [{ type: "sum", field: "x" }],
					}),
				/requires non-empty data/,
			);
		});

		it("should throw on missing formula string", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "compute",
						data: [{ col1: 10 }],
						operations: [{ type: "formula" }],
					}),
				/formula operation requires a formula string/,
			);
		});

		it("should reject unknown operation type via Zod", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "compute",
						data: [{ v: 1 }],
						operations: [{ type: "unknown" }],
					}),
				/Invalid option/,
			);
		});

		it("should handle sum with missing field values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ price: 10 }, { price: undefined }, { price: null }],
				operations: [{ type: "sum", field: "price" }],
			});
			assert.strictEqual(result.results[0].value, 10);
		});

		it("should handle average with empty values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 20 }],
				operations: [{ type: "average", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 15);
		});

		it("should handle min with empty values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: undefined }],
				operations: [{ type: "min", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 10);
		});

		it("should handle max with empty values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: undefined }],
				operations: [{ type: "max", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 10);
		});

		it("should include alias in result", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 20 }],
				operations: [{ type: "sum", field: "v", alias: "total" }],
			});
			assert.strictEqual(result.results[0].alias, "total");
		});

		it("should handle multiple operations", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: 10 }, { v: 20 }, { v: 30 }],
				operations: [
					{ type: "sum", field: "v" },
					{ type: "average", field: "v" },
					{ type: "count" },
				],
			});
			assert.strictEqual(result.results.length, 3);
			assert.strictEqual(result.results[0].value, 60);
			assert.strictEqual(result.results[1].value, 20);
			assert.strictEqual(result.results[2].value, 3);
		});

		it("should handle sum with all non-numeric values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: "abc" }, { v: "def" }],
				operations: [{ type: "sum", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 0);
		});

		it("should handle min with all non-numeric values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: "abc" }, { v: "def" }],
				operations: [{ type: "min", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 0);
		});

		it("should handle max with all non-numeric values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: "abc" }, { v: "def" }],
				operations: [{ type: "max", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 0);
		});

		it("should handle average with all non-numeric values", async () => {
			const result = await callSpreadsheet({
				action: "compute",
				data: [{ v: "abc" }, { v: "def" }],
				operations: [{ type: "average", field: "v" }],
			});
			assert.strictEqual(result.results[0].value, 0);
		});
	});

	describe("generate", () => {
		it("should generate a simple spreadsheet", async () => {
			const result = await callSpreadsheet({
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
			const result = await callSpreadsheet({
				action: "generate",
				sheets: [
					{ name: "Sheet1", rows: [{ values: [1] }] },
					{ name: "Sheet2", rows: [{ values: [2] }] },
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.sheets.length, 2);
		});

		it("should throw on missing sheets", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "generate",
						outputPath: "/tmp/test.xlsx",
					}),
				/generate\(\) requires at least one sheet/,
			);
		});

		it("should throw on empty sheets", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "generate",
						sheets: [],
						outputPath: "/tmp/test.xlsx",
					}),
				/generate\(\) requires at least one sheet/,
			);
		});

		it("should handle formulas in cells", async () => {
			const result = await callSpreadsheet({
				action: "generate",
				sheets: [
					{
						name: "Sheet1",
						rows: [{ values: [1, 2], formulas: { "1": "=A1*2" } }],
					},
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
			assert.strictEqual(result.workbook.sheets[0].rows[0]["A1"].value, 1);
			assert.strictEqual(result.workbook.sheets[0].rows[0]["B1"].formula, "=A1*2");
		});

		it("should handle empty rows array", async () => {
			const result = await callSpreadsheet({
				action: "generate",
				sheets: [
					{
						name: "Sheet1",
						rows: [],
					},
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
		});

		it("should handle formatting in cells", async () => {
			const result = await callSpreadsheet({
				action: "generate",
				sheets: [
					{
						name: "Sheet1",
						rows: [{ values: [1], formatting: { "0": { bold: true } } }],
					},
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
		});

		it("should handle many columns (beyond Z)", async () => {
			const values = Array.from({ length: 30 }, (_, i) => i + 1);
			const result = await callSpreadsheet({
				action: "generate",
				sheets: [
					{
						name: "Sheet1",
						rows: [{ values }],
					},
				],
				outputPath: "/tmp/test.xlsx",
			});
			assert.strictEqual(result.status, "generated");
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
			const result = await callSpreadsheet({
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
			const result = await callSpreadsheet({
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
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "stats",
						config: { field: "val" },
					},
				],
			});
			assert.ok(result.results[0].mean);
			assert.ok(result.results[0].median);
			assert.ok(result.results[0].stddev);
		});

		it("should perform groupBy", async () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "groupBy",
						config: { keys: "region" },
					},
				],
			});
			assert.strictEqual(result.results[0].groups, 2);
		});

		it("should compute percentile", async () => {
			const data = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }, { val: 5 }];
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "percentile",
						config: { field: "val", p: 50 },
					},
				],
			});
			assert.strictEqual(result.results[0].value, 3);
		});

		it("should handle stats with single value (stddev=0)", async () => {
			const data = [{ val: 42 }];
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "stats",
						config: { field: "val" },
					},
				],
			});
			assert.strictEqual(result.results[0].stddev, 0);
		});

		it("should reject unknown analysis type via Zod", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "analyze",
						data: [{ v: 1 }],
						analysisOperations: [{ type: "unknown", config: {} }],
					}),
				/Invalid option/,
			);
		});

		it("should throw on empty data", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "analyze",
						data: [],
						analysisOperations: [{ type: "stats", config: { field: "val" } }],
					}),
				/analyze\(\) requires non-empty data/,
			);
		});

		it("should handle multiple analysis operations", async () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
			];
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{ type: "pivot", config: { keys: "region", value: "sales", aggregate: "sum" } },
					{ type: "stats", config: { field: "sales" } },
				],
			});
			assert.strictEqual(result.results.length, 2);
		});

		it("should handle groupBy with multiple keys", async () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
			];
			const result = await callSpreadsheet({
				action: "analyze",
				data,
				analysisOperations: [
					{
						type: "groupBy",
						config: { keys: ["region", "product"] },
					},
				],
			});
			assert.strictEqual(result.results[0].groups, 3);
		});
	});

	describe("csvImport", () => {
		it("should import a CSV string", async () => {
			const csvData = "name,age\nAlice,30\nBob,25";
			const result = await callSpreadsheet({
				action: "csvImport",
				content: csvData,
			});
			assert.strictEqual(result.records, 2);
		});

		it("should import with custom delimiter", async () => {
			const csvData = "name;age\nAlice;30";
			const result = await callSpreadsheet({
				action: "csvImport",
				content: csvData,
				delimiter: ";",
			});
			assert.strictEqual(result.records, 1);
		});

		it("should import with custom quote", async () => {
			const csvData = "name,note\nAlice,'hello, world'";
			const result = await callSpreadsheet({
				action: "csvImport",
				content: csvData,
				quote: "'",
			});
			assert.strictEqual(result.records, 1);
		});

		it("should import with trim option", async () => {
			const csvData = "name , age\nAlice , 30";
			const result = await callSpreadsheet({
				action: "csvImport",
				content: csvData,
				trim: true,
			});
			assert.strictEqual(result.records, 1);
		});

		it("should throw on empty content", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "csvImport",
						content: "",
					}),
				/csvImport\(\) requires a non-empty CSV string/,
			);
		});
	});

	describe("csvExport", () => {
		it("should export data to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "csvExport",
				data,
			});
			assert.ok(typeof result.csv === "string");
			assert.ok(result.csv.includes("name,age"));
		});

		it("should export with custom delimiter", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "csvExport",
				data,
				delimiter: ";",
			});
			assert.ok(result.csv.includes("name;age"));
		});

		it("should export with custom quote", async () => {
			const data = [{ name: "Alice", note: "hello, world" }];
			const result = await callSpreadsheet({
				action: "csvExport",
				data,
				quote: "'",
			});
			assert.ok(result.csv.includes("'hello, world'"));
		});

		it("should export without header", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "csvExport",
				data,
				header: false,
			});
			assert.ok(!result.csv.includes("name,age"));
		});

		it("should throw on empty data", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "csvExport",
						data: [],
					}),
				/csvExport\(\) requires a non-empty array of objects/,
			);
		});
	});

	describe("modify", () => {
		let testXlsx;
		let testOutput;

		before(async () => {
			const { default: ExcelJS } = await import("exceljs");
			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet("Sheet1");
			sheet.getCell("A1").value = 10;
			sheet.getCell("B1").value = 20;
			testXlsx = "/tmp/test-modify-input.xlsx";
			testOutput = "/tmp/test-modify-output.xlsx";
			await workbook.xlsx.writeFile(testXlsx);
		});

		after(() => {
			try { fs.unlinkSync(testXlsx); } catch { /* ignore */ }
			try { fs.unlinkSync(testOutput); } catch { /* ignore */ }
		});

		it("should throw on missing input file", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "modify",
						inputPath: "/tmp/nonexistent.xlsx",
						modifyOperations: [],
						outputPath: "/tmp/out.xlsx",
					}),
				/Input file not found/,
			);
		});

		it("should add a cell", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "addCell", sheetName: "Sheet1", cellRef: "C1", value: 30 }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.status, "modified");
			assert.strictEqual(result.operations, 1);
			assert.strictEqual(result.results[0].status, "added");
		});

		it("should modify a cell", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "modifyCell", sheetName: "Sheet1", cellRef: "A1", value: 99 }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "modified");
		});

		it("should delete a cell", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "deleteCell", sheetName: "Sheet1", cellRef: "A1" }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "deleted");
		});

		it("should add a sheet", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "addSheet", sheetName: "Sheet2" }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "added");
		});

		it("should delete a sheet", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [
					{ type: "addSheet", sheetName: "TempSheet" },
					{ type: "deleteSheet", sheetName: "TempSheet" },
				],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[1].status, "deleted");
		});

		it("should rename a sheet", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "renameSheet", sheetName: "Sheet1", newName: "Renamed" }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "renamed");
		});

		it("should handle missing sheet gracefully", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "addCell", sheetName: "NonExistent", cellRef: "A1", value: 1 }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "error");
			assert.ok(result.results[0].reason.includes("not found"));
		});

		it("should handle unknown modify operation", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "modify",
						inputPath: testXlsx,
						modifyOperations: [{ type: "unknownOp", sheetName: "Sheet1" }],
						outputPath: testOutput,
					}),
				/Invalid option/,
			);
		});

		it("should add a cell with formula", async () => {
			const result = await callSpreadsheet({
				action: "modify",
				inputPath: testXlsx,
				modifyOperations: [{ type: "addCell", sheetName: "Sheet1", cellRef: "C1", formula: "=A1+B1" }],
				outputPath: testOutput,
			});
			assert.strictEqual(result.results[0].status, "added");
		});
	});

	describe("export", () => {
		it("should export to JSON", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "export",
				data,
				format: "json",
				outputPath: "/tmp/test.json",
			});
			assert.ok(result.output.includes("Alice"));
		});

		it("should export to CSV", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "export",
				data,
				format: "csv",
				outputPath: "/tmp/test.csv",
			});
			assert.ok(result.output.includes("name,age"));
		});

		it("should throw on empty data", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "export",
						data: [],
						format: "json",
						outputPath: "/tmp/test.json",
					}),
				/export\(\) requires non-empty data/,
			);
		});

		it("should reject unsupported format via Zod", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "export",
						data: [{ v: 1 }],
						format: "xml",
						outputPath: "/tmp/test.xml",
					}),
				/Invalid option/,
			);
		});

		it("should export to JSON without outputPath", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "export",
				data,
				format: "json",
			});
			assert.ok(result.output.includes("Alice"));
		});

		it("should export to CSV without outputPath", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "export",
				data,
				format: "csv",
			});
			assert.ok(result.output.includes("name,age"));
		});

		it("should export to XLSX", async () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = await callSpreadsheet({
				action: "export",
				data,
				format: "xlsx",
				outputPath: "/tmp/test-export.xlsx",
			});
			assert.strictEqual(result.format, "xlsx");
			assert.strictEqual(result.status, "generated");
			assert.strictEqual(result.rows, 1);
			assert.deepStrictEqual(result.columns, ["name", "age"]);
			try { fs.unlinkSync("/tmp/test-export.xlsx"); } catch { /* ignore */ }
		});
	});

	describe("unknown action", () => {
		it("should reject unknown action via Zod", async () => {
			await assert.rejects(
				() =>
					callSpreadsheet({
						action: "unknown",
					}),
				/Invalid option/,
			);
		});
	});
});
