/**
 * Tests for the spreadsheet CSV module.
 * @see {@link src/tools/spreadsheet/csv.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as csv from "../../../../src/tools/spreadsheet/csv.js";

describe("csv", () => {
	describe("csvImport", () => {
		it("should parse a simple CSV string", () => {
			const result = csv.csvImport("name,age\nAlice,30\nBob,25");
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].name, "Alice");
			assert.strictEqual(result[0].age, 30);
		});

		it("should handle custom delimiter", () => {
			const result = csv.csvImport("name;age\nAlice;30", { delimiter: ";" });
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].name, "Alice");
		});

		it("should handle quoted fields", () => {
			const result = csv.csvImport('name,note\nAlice,"hello, world"');
			assert.strictEqual(result[0].note, "hello, world");
		});

		it("should handle multiline quoted fields", () => {
			const result = csv.csvImport('name,note\nAlice,"line1\nline2"');
			assert.ok(result[0].note.includes("line1"));
			assert.ok(result[0].note.includes("line2"));
		});

		it("should throw for empty content", () => {
			assert.throws(() => csv.csvImport(""), /non-empty/);
		});

		it("should throw for header-only content", () => {
			assert.throws(() => csv.csvImport("name,age"), /no records/);
		});

		it("should trim whitespace when trim option is true", () => {
			const result = csv.csvImport("name , age\nAlice , 30", { trim: true });
			assert.ok(!result[0].hasOwnProperty("name "));
			assert.ok(!result[0].hasOwnProperty(" age"));
		});
	});

	describe("csvExport", () => {
		it("should export data to CSV string", () => {
			const data = [
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			];
			const result = csv.csvExport(data);
			assert.ok(result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
			assert.ok(result.includes("Bob,25"));
		});

		it("should respect custom delimiter", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { delimiter: ";" });
			assert.ok(result.includes("name;age"));
			assert.ok(result.includes("Alice;30"));
		});

		it("should omit header when header option is false", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { header: false });
			assert.ok(!result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
		});

		it("should throw for empty data", () => {
			assert.throws(() => csv.csvExport([]), /non-empty/);
		});

		it("should quote fields containing commas", () => {
			const data = [{ name: "Alice", note: "hello, world" }];
			const result = csv.csvExport(data);
			assert.ok(result.includes('"hello, world"'));
		});

		it("should respect columns option", () => {
			const data = [{ name: "Alice", age: "30", city: "Ottawa" }];
			const result = csv.csvExport(data, { columns: ["name", "city"] });
			assert.ok(result.includes("name,city"));
			assert.ok(result.includes("Alice,Ottawa"));
			assert.ok(!result.includes("age"));
		});

		it("should respect record_delimiter option", () => {
			const data = [{ name: "Alice" }, { name: "Bob" }];
			const result = csv.csvExport(data, { record_delimiter: "\r\n" });
			assert.ok(result.includes("\r\n"));
		});

		it("should cast Date values to ISO string", () => {
			const date = new Date("2024-01-15T12:00:00Z");
			const data = [{ name: "Alice", created: date }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("2024-01-15T12:00:00.000Z"));
		});

		it("should cast non-Date objects to string", () => {
			const data = [{ name: "Alice", meta: { foo: "bar" } }];
			const result = csv.csvExport(data);
			// CSV stringify escapes double quotes by doubling them
			assert.ok(result.includes('""foo""'));
		});

		it("should cast number values to string", () => {
			const data = [{ name: "Alice", score: 42 }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("42"));
		});

		it("should cast boolean values to string", () => {
			const data = [{ name: "Alice", active: true }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("true"));
		});

		it("should throw on csvExport error", () => {
			// Pass invalid data that causes stringify to fail
			const data = [Symbol("test")];
			assert.throws(() => csv.csvExport(data), /csvExport/);
		});
	});

	describe("csvToJson", () => {
		it("should convert CSV to JSON string", () => {
			const csvStr = "name,age\nAlice,30\nBob,25";
			const result = csv.csvToJson(csvStr);
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.length, 2);
			assert.strictEqual(parsed[0].name, "Alice");
			assert.strictEqual(parsed[0].age, 30);
		});

		it("should pass options to csvImport", () => {
			const csvStr = "name;age\nAlice;30";
			const result = csv.csvToJson(csvStr, { delimiter: ";" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed[0].name, "Alice");
			assert.strictEqual(parsed[0].age, 30);
		});
	});

	describe("jsonToCsv", () => {
		it("should convert JSON array to CSV string", () => {
			const json = JSON.stringify([{ name: "Alice", age: "30" }]);
			const result = csv.jsonToCsv(json);
			assert.ok(result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
		});

		it("should pass options to csvExport", () => {
			const json = JSON.stringify([{ name: "Alice", age: "30" }]);
			const result = csv.jsonToCsv(json, { header: false });
			assert.ok(!result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
		});

		it("should throw for non-array JSON", () => {
			assert.throws(() => csv.jsonToCsv('{"name": "Alice"}'), /JSON array/);
		});
	});

	describe("toXlsxFormat", () => {
		it("should convert data to 2D array with headers", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result.length, 2);
			assert.deepStrictEqual(result[0], ["name", "age"]);
			assert.deepStrictEqual(result[1], ["Alice", "30"]);
		});

		it("should respect columns option", () => {
			const data = [{ name: "Alice", age: "30", city: "Ottawa" }];
			const result = csv.toXlsxFormat(data, ["name", "city"]);
			assert.strictEqual(result.length, 2);
			assert.deepStrictEqual(result[0], ["name", "city"]);
			assert.deepStrictEqual(result[1], ["Alice", "Ottawa"]);
		});

		it("should use undefined for missing values", () => {
			const data = [{ name: "Alice" }];
			const result = csv.toXlsxFormat(data, ["name", "age"]);
			assert.strictEqual(result[1][1], "");
		});

		it("should handle multiple rows", () => {
			const data = [
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result.length, 3);
			assert.deepStrictEqual(result[1], ["Alice", "30"]);
			assert.deepStrictEqual(result[2], ["Bob", "25"]);
		});

		it("should throw for empty data", () => {
			assert.throws(() => csv.toXlsxFormat([]), /non-empty/);
		});

		it("should throw for non-array data", () => {
			assert.throws(() => csv.toXlsxFormat("not an array"), /non-empty/);
		});
	});
});
