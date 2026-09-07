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

		it("should throw on empty content", () => {
			assert.throws(() => csv.csvImport(""), /non-empty CSV string/);
		});

		it("should throw on whitespace-only content", () => {
			assert.throws(() => csv.csvImport("   "), /non-empty CSV string/);
		});

		it("should throw on header-only content", () => {
			assert.throws(() => csv.csvImport("name,age"), /no records/);
		});

		it("should trim whitespace when trim option is true", () => {
			const result = csv.csvImport("name , age\nAlice , 30", { trim: true });
			assert.strictEqual(result[0].name, "Alice");
			assert.strictEqual(result[0].age, 30);
		});

		it("should handle boolean cast", () => {
			const result = csv.csvImport("name,active\nAlice,true\nBob,false");
			assert.strictEqual(result[0].active, true);
			assert.strictEqual(result[1].active, false);
		});

		it("should handle empty fields", () => {
			const result = csv.csvImport("name,age,city\nAlice,30,");
			assert.strictEqual(result[0].name, "Alice");
			assert.strictEqual(result[0].age, 30);
			assert.strictEqual(result[0].city, "");
		});

		it("should handle custom escape character", () => {
			const result = csv.csvImport('name,note\nAlice,"he says ""hello"""', { escape: '"' });
			assert.strictEqual(result[0].note, 'he says "hello"');
		});

		it("should handle skip_empty_lines option", () => {
			const result = csv.csvImport("name,age\nAlice,30\n\nBob,25", { skip_empty_lines: true });
			assert.strictEqual(result.length, 2);
		});

		it("should handle columns=false to return arrays", () => {
			const result = csv.csvImport("name,age\nAlice,30", { columns: false });
			assert.ok(Array.isArray(result[0]));
		});

		it("should throw on non-string input", () => {
			assert.throws(() => csv.csvImport(null), /non-empty CSV string/);
			assert.throws(() => csv.csvImport(undefined), /non-empty CSV string/);
			assert.throws(() => csv.csvImport(42), /non-empty CSV string/);
		});

		it("should handle parse errors gracefully", () => {
			assert.throws(() => csv.csvImport('name,age\nAlice,"30'), /csvImport\(\) failed/);
		});

		it("should handle scientific notation numbers", () => {
			const result = csv.csvImport("value\n1e10\n2.5e-3");
			assert.strictEqual(result[0].value, 1e10);
			assert.strictEqual(result[1].value, 2.5e-3);
		});

		it("should handle very large numbers", () => {
			const result = csv.csvImport("value\n9999999999999999");
			assert.strictEqual(result[0].value, 10000000000000000);
		});

		it("should handle empty string in cast returning original value", () => {
			const result = csv.csvImport("name,note\nAlice,");
			assert.strictEqual(result[0].note, "");
		});

		it("should handle encoding option", () => {
			const result = csv.csvImport("name,age\nAlice,30", { encoding: "utf-8" });
			assert.strictEqual(result[0].name, "Alice");
		});

		it("should handle single column CSV", () => {
			const result = csv.csvImport("value\n1\n2\n3");
			assert.strictEqual(result.length, 3);
			assert.strictEqual(result[0].value, 1);
		});

		it("should handle CRLF line endings", () => {
			const result = csv.csvImport("name,age\r\nAlice,30\r\nBob,25");
			assert.strictEqual(result.length, 2);
		});

		it("should handle Infinity values without converting to number", () => {
			const result = csv.csvImport("value\nInfinity\n-Infinity");
			assert.strictEqual(result[0].value, "Infinity");
			assert.strictEqual(result[1].value, "-Infinity");
		});

		it("should handle NaN values without converting to number", () => {
			const result = csv.csvImport("value\nNaN");
			assert.strictEqual(result[0].value, "NaN");
		});

		it("should handle columns as array", () => {
			const result = csv.csvImport("1,2\n3,4", { columns: ["a", "b"] });
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].a, 1);
			assert.strictEqual(result[0].b, 2);
			assert.strictEqual(result[1].a, 3);
			assert.strictEqual(result[1].b, 4);
		});

		it("should throw when columns array length differs from CSV columns", () => {
			assert.throws(
				() => csv.csvImport("1,2\n3,4", { columns: ["a", "b", "c"] }),
				/csvImport\(\) failed/,
			);
			assert.throws(
				() => csv.csvImport("1,2,3\n4,5,6", { columns: ["a"] }),
				/csvImport\(\) failed/,
			);
		});

		it("should handle custom escape character with backslash", () => {
			const result = csv.csvImport('name,note\nAlice,"escaped\\"quote"', { escape: "\\" });
			assert.strictEqual(result[0].note, 'escaped"quote');
		});

		it("should handle negative numbers", () => {
			const result = csv.csvImport("value\n-30\n-0.5");
			assert.strictEqual(result[0].value, -30);
			assert.strictEqual(result[1].value, -0.5);
		});

		it("should handle zero values", () => {
			const result = csv.csvImport("value\n0");
			assert.strictEqual(result[0].value, 0);
		});

		it("should handle default skip_empty_lines behavior (false)", () => {
			const result = csv.csvImport("name,age\nAlice,30\nBob,25", { skip_empty_lines: false });
			assert.strictEqual(result.length, 2);
		});

		it("should handle columns=false with no data rows returns header as data", () => {
			const result = csv.csvImport("name,age", { columns: false });
			assert.strictEqual(result.length, 1);
			assert.deepStrictEqual(result[0], ["name", "age"]);
		});

		it("should handle non-numeric non-boolean string fallback in cast", () => {
			const result = csv.csvImport("name,note\nAlice,hello");
			assert.strictEqual(result[0].note, "hello");
		});

		it("should handle hexadecimal-like strings", () => {
			const result = csv.csvImport("value\n0xFF");
			assert.strictEqual(result[0].value, 255);
		});

		it("should handle trim option being false", () => {
			// When trim is false, field names retain whitespace but cast still trims for type conversion
			const result = csv.csvImport("name , age\nAlice , 30", { trim: false });
			assert.strictEqual(result[0]["name "], "Alice ");
			assert.strictEqual(result[0][" age"], 30);
		});

		it("should handle skip_empty_lines with multiple consecutive empty lines", () => {
			const result = csv.csvImport("name,age\nAlice,30\n\n\nBob,25", { skip_empty_lines: true });
			assert.strictEqual(result.length, 2);
		});

		it("should handle columns as array with no data rows", () => {
			const result = csv.csvImport("a,b", { columns: ["x", "y"] });
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].x, "a");
			assert.strictEqual(result[0].y, "b");
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

		it("should throw on empty data", () => {
			assert.throws(() => csv.csvExport([]), /non-empty array/);
		});

		it("should throw on non-array data", () => {
			assert.throws(() => csv.csvExport(null), /non-empty array/);
			assert.throws(() => csv.csvExport(undefined), /non-empty array/);
			assert.throws(() => csv.csvExport("string"), /non-empty array/);
		});

		it("should quote fields containing commas", () => {
			const data = [{ name: "Alice", note: "hello, world" }];
			const result = csv.csvExport(data);
			assert.ok(result.includes('"hello, world"'));
		});

		it("should quote fields containing quotes", () => {
			const data = [{ name: "Alice", note: 'he said "hello"' }];
			const result = csv.csvExport(data);
			assert.ok(result.includes('"he said ""hello"""'));
		});

		it("should handle specific columns option", () => {
			const data = [
				{ name: "Alice", age: "30", city: "NYC" },
				{ name: "Bob", age: "25", city: "LA" },
			];
			const result = csv.csvExport(data, { columns: ["name", "city"] });
			assert.ok(result.includes("name,city"));
			assert.ok(result.includes("Alice,NYC"));
			assert.ok(!result.includes("age"));
		});

		it("should handle custom record delimiter", () => {
			const data = [
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			];
			const result = csv.csvExport(data, { record_delimiter: "\r\n" });
			assert.ok(result.includes("\r\n"));
		});

		it("should handle custom quote character", () => {
			const data = [{ name: "Alice", note: "hello, world" }];
			const result = csv.csvExport(data, { quote: "'" });
			assert.ok(result.includes("'hello, world'"));
		});

		it("should handle custom escape character", () => {
			const data = [{ name: "Alice", note: 'he said "hello"' }];
			const result = csv.csvExport(data, { escape: "\\" });
			assert.ok(result);
		});

		it("should handle boolean values in export", () => {
			const data = [{ name: "Alice", active: true }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("true"));
		});

		it("should handle date values in export", () => {
			const data = [{ name: "Alice", joined: new Date("2024-01-15") }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("2024-01-15"));
		});

		it("should handle non-Date values in date cast fallback", () => {
			const data = [{ name: "Alice", joined: "2024-01-15T00:00:00.000Z" }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("2024-01-15"));
		});

		it("should handle object values in export", () => {
			const data = [{ name: "Alice", meta: { role: "admin" } }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("role"));
		});

		it("should handle number values in export", () => {
			const data = [{ name: "Alice", age: 30 }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("30"));
		});

		it("should handle empty string values", () => {
			const data = [{ name: "Alice", note: "" }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("Alice,"));
		});

		it("should handle null values", () => {
			const data = [{ name: "Alice", age: null }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("Alice,"));
		});

		it("should handle undefined values", () => {
			const data = [{ name: "Alice", age: undefined }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("Alice,"));
		});

		it("should handle single row", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data);
			assert.strictEqual(result.trim().split("\n").length, 2);
		});

		it("should handle columns option preserving order", () => {
			const data = [{ name: "Alice", age: "30", city: "NYC" }];
			const result = csv.csvExport(data, { columns: ["city", "name"] });
			const lines = result.trim().split("\n");
			assert.ok(lines[0].includes("city,name"));
			assert.ok(lines[1].includes("NYC,Alice"));
		});

		it("should throw on circular reference objects", () => {
			const data = [{ name: "Alice" }];
			data[0].self = data[0];
			assert.throws(() => csv.csvExport(data), /csvExport\(\) failed/);
		});

		it("should handle columns option with extra columns not in data", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { columns: ["name", "age", "city"] });
			const lines = result.trim().split("\n");
			assert.ok(lines[0].includes("name,age,city"));
			assert.ok(lines[1].includes("Alice,30,"));
		});

		it("should handle record_delimiter as \\r", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { record_delimiter: "\r" });
			assert.ok(result.includes("Alice,30\r"));
		});

		it("should handle header=true explicitly", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { header: true });
			assert.ok(result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
		});

		it("should handle columns option with empty array", () => {
			const data = [{ name: "Alice", age: "30" }];
			const result = csv.csvExport(data, { columns: [] });
			// Empty columns array means no columns are exported; produces empty output
			assert.strictEqual(result.trim(), "");
		});

		it("should handle boolean false values in export", () => {
			const data = [{ name: "Alice", active: false }];
			const result = csv.csvExport(data);
			assert.ok(result.includes("false"));
		});
	});

	describe("csvToJson", () => {
		it("should convert CSV to JSON string", () => {
			const result = csv.csvToJson("name,age\nAlice,30\nBob,25");
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.length, 2);
			assert.strictEqual(parsed[0].name, "Alice");
		});

		it("should pass options to csvImport", () => {
			const result = csv.csvToJson("name;age\nAlice;30", { delimiter: ";" });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed[0].name, "Alice");
		});

		it("should throw on invalid CSV", () => {
			assert.throws(() => csv.csvToJson(""), /non-empty CSV string/);
		});

		it("should produce pretty-printed JSON", () => {
			const result = csv.csvToJson("name,age\nAlice,30");
			assert.ok(result.includes("\n"));
		});

		it("should handle custom options like trim", () => {
			const result = csv.csvToJson("name , age\nAlice , 30", { trim: true });
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed[0].name, "Alice");
		});
	});

	describe("jsonToCsv", () => {
		it("should convert JSON string to CSV", () => {
			const json = JSON.stringify([
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			]);
			const result = csv.jsonToCsv(json);
			assert.ok(result.includes("name,age"));
			assert.ok(result.includes("Alice,30"));
		});

		it("should pass options to csvExport", () => {
			const json = JSON.stringify([{ name: "Alice", age: "30" }]);
			const result = csv.jsonToCsv(json, { delimiter: ";" });
			assert.ok(result.includes("name;age"));
		});

		it("should throw on non-array JSON", () => {
			assert.throws(() => csv.jsonToCsv('{"name": "Alice"}'), /JSON array/);
		});

		it("should throw on invalid JSON", () => {
			assert.throws(() => csv.jsonToCsv("not json"), /JSON/);
		});

		it("should throw on empty array JSON", () => {
			assert.throws(() => csv.jsonToCsv("[]"), /non-empty array/);
		});

		it("should handle single object array", () => {
			const json = JSON.stringify([{ name: "Alice", age: "30" }]);
			const result = csv.jsonToCsv(json);
			assert.ok(result.includes("Alice,30"));
		});
	});

	describe("toXlsxFormat", () => {
		it("should convert objects to 2D array", () => {
			const data = [
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result.length, 3);
			assert.deepStrictEqual(result[0], ["name", "age"]);
			assert.deepStrictEqual(result[1], ["Alice", 30]);
			assert.deepStrictEqual(result[2], ["Bob", 25]);
		});

		it("should use specified columns", () => {
			const data = [
				{ name: "Alice", age: 30, city: "NYC" },
				{ name: "Bob", age: 25, city: "LA" },
			];
			const result = csv.toXlsxFormat(data, ["name", "city"]);
			assert.deepStrictEqual(result[0], ["name", "city"]);
			assert.deepStrictEqual(result[1], ["Alice", "NYC"]);
		});

		it("should throw on empty data", () => {
			assert.throws(() => csv.toXlsxFormat([]), /non-empty array/);
		});

		it("should throw on non-array data", () => {
			assert.throws(() => csv.toXlsxFormat(null), /non-empty array/);
		});

		it("should handle missing fields with empty string", () => {
			const data = [{ name: "Alice", age: 30 }, { name: "Bob" }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result[0][0], "name");
			assert.strictEqual(result[0][1], "age");
			assert.strictEqual(result[1][0], "Alice");
			assert.strictEqual(result[1][1], 30);
			assert.strictEqual(result[2][0], "Bob");
			assert.strictEqual(result[2][1], "");
		});

		it("should handle empty columns array", () => {
			const data = [{ name: "Alice", age: 30 }];
			const result = csv.toXlsxFormat(data, []);
			assert.deepStrictEqual(result[0], []);
			assert.deepStrictEqual(result[1], []);
		});

		it("should handle single object", () => {
			const data = [{ name: "Alice", age: 30 }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result.length, 2);
			assert.deepStrictEqual(result[1], ["Alice", 30]);
		});

		it("should handle objects with different key sets", () => {
			const data = [
				{ name: "Alice", age: 30 },
				{ name: "Bob", city: "LA" },
			];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result[2][1], "");
			assert.strictEqual(result[2][2], undefined);
		});

		it("should handle columns=null by using Object.keys", () => {
			const data = [{ name: "Alice", age: 30 }];
			const result = csv.toXlsxFormat(data, null);
			assert.deepStrictEqual(result[0], ["name", "age"]);
			assert.deepStrictEqual(result[1], ["Alice", 30]);
		});

		it("should handle undefined columns by using Object.keys", () => {
			const data = [{ name: "Alice", age: 30 }];
			const result = csv.toXlsxFormat(data, undefined);
			assert.deepStrictEqual(result[0], ["name", "age"]);
			assert.deepStrictEqual(result[1], ["Alice", 30]);
		});

		it("should handle null field values with ?? empty string", () => {
			const data = [{ name: "Alice", age: null }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result[1][1], "");
		});

		it("should handle undefined field values with ?? empty string", () => {
			const data = [{ name: "Alice", age: undefined }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result[1][1], "");
		});

		it("should handle zero and false field values without replacement", () => {
			const data = [{ name: "Alice", count: 0, active: false }];
			const result = csv.toXlsxFormat(data);
			assert.strictEqual(result[1][1], 0);
			assert.strictEqual(result[1][2], false);
		});
	});
});
