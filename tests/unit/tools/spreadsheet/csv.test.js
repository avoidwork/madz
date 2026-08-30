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
	});
});
