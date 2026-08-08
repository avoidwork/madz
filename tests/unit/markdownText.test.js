import { describe, it } from "node:test";
import assert from "node:assert";
import { generateTableRow, parseMarkdown } from "../../src/tui/markdownText.js";

describe("generateTableRow - table cell parsing", () => {
	it("parses a single row with two cells", () => {
		// Simulate what tablerow() + tablecell() produce
		// tablerow: '*|*|*|' + text + '*|*|*|'
		// tablecell: content + '^*||*^'
		const row = "*|*|*|Name^*||*^Age^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Name", "Age"]]);
	});

	it("parses a single row with three cells", () => {
		const row = "*|*|*|Name^*||*^Age^*||*^City^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Name", "Age", "City"]]);
	});

	it("parses multiple rows", () => {
		const text =
			"*|*|*|Name^*||*^Age^*||*^*|*|*|\n*|*|*|Alice^*||*^30^*||*^*|*|*|";
		const result = generateTableRow(text);
		assert.deepStrictEqual(result, [
			["Name", "Age"],
			["Alice", "30"],
		]);
	});

	it("returns empty array for empty string", () => {
		assert.deepStrictEqual(generateTableRow(""), []);
	});

	it("returns empty array for null", () => {
		assert.deepStrictEqual(generateTableRow(null), []);
	});

	it("skips empty lines", () => {
		const text = "*|*|*|Name^*||*^*|*|*|\n\n*|*|*|Alice^*||*^*|*|*|";
		const result = generateTableRow(text);
		assert.deepStrictEqual(result, [["Name"], ["Alice"]]);
	});

	it("applies escape function to cell content", () => {
		const row = "*|*|*|Name^*||*^Age^*||*^*|*|*|";
		const escape = (t) => t.replace("Name", "ESCAPED");
		const result = generateTableRow(row, escape);
		assert.deepStrictEqual(result, [["ESCAPED", "Age"]]);
	});

	it("handles cells with special characters", () => {
		const row = "*|*|*|Hello, World!^*||*^100%^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Hello, World!", "100%"]]);
	});

	it("handles cells with pipe characters in content", () => {
		// Pipe in cell content should be preserved (it's inside ^*||*^)
		const row = "*|*|*|a|b^*||*^c^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["a|b", "c"]]);
	});

	it("handles empty cells", () => {
		const row = "*|*|*|^*||*^Value^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["", "Value"]]);
	});

	it("handles single cell row", () => {
		const row = "*|*|*|Only^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Only"]]);
	});

	it("handles four cells", () => {
		const row = "*|*|*|A^*||*^B^*||*^C^*||*^D^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["A", "B", "C", "D"]]);
	});
});

describe("parseMarkdown - table rendering", () => {
	it("renders a simple table", () => {
		const markdown = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
		// Should contain table-like structure (cli-table3 uses ASCII art)
		assert.ok(result.includes("Name") || result.includes("Alice"));
	});

	it("renders a table with three columns", () => {
		const markdown =
			"| Name | Age | City |\n|------|-----|------|\n| Alice | 30 | Ottawa |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
		assert.ok(result.includes("Name"));
		assert.ok(result.includes("Alice"));
		assert.ok(result.includes("Ottawa"));
	});

	it("renders a table with multiple rows", () => {
		const markdown =
			"| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |\n| Carol | 35 |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Alice"));
		assert.ok(result.includes("Bob"));
		assert.ok(result.includes("Carol"));
	});

	it("renders a table with special characters", () => {
		const markdown =
			"| Item | Value |\n|------|-------|\n| Score | 100% |\n| Note | Good! |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("100%"));
		assert.ok(result.includes("Good!"));
	});

	it("renders a table with empty cells", () => {
		const markdown = "| Name | Age |\n|------|-----|\n| | 30 |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("renders a table followed by text", () => {
		const markdown =
			"| Name | Age |\n|------|-----|\n| Alice | 30 |\n\nSome text after.";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Alice"));
		assert.ok(result.includes("Some text after"));
	});

	it("renders a table with code in cells", () => {
		const markdown = "| Func | Desc |\n|------|------|\n| `foo()` | Does stuff |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("foo()"));
		assert.ok(result.includes("Does stuff"));
	});
});

describe("generateTableRow - edge cases", () => {
	it("handles whitespace in cell content", () => {
		const row = "*|*|*|Hello World^*||*^Foo Bar^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Hello World", "Foo Bar"]]);
	});

	it("handles numeric cell content", () => {
		const row = "*|*|*|123^*||*^456^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["123", "456"]]);
	});

	it("handles mixed content types", () => {
		const row = "*|*|*|Text^*||*^123^*||*^True^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["Text", "123", "True"]]);
	});

	it("preserves content with asterisks", () => {
		const row = "*|*|*|**bold**^*||*^*italic*^*||*^*|*|*|";
		const result = generateTableRow(row);
		assert.deepStrictEqual(result, [["**bold**", "*italic*"]]);
	});

	it("handles very long cell content", () => {
		const long = "a".repeat(100);
		const row = `*|*|*|${long}^*||*^short^*||*^*|*|*|`;
		const result = generateTableRow(row);
		assert.strictEqual(result[0][0].length, 100);
		assert.strictEqual(result[0][1], "short");
	});
});
