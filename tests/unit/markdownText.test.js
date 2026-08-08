import { describe, it } from "node:test";
import assert from "node:assert";
import { generateTableRow, parseMarkdown } from "../../src/tui/markdownText.js";

// Helper: strip ANSI escape codes for comparison
function stripAnsi(str) {
	const ESCAPE = "\u001b";
	const BELL = "\u0007";
	return str
		.replace(new RegExp(ESCAPE + "\\[[\\d;]*m", "g"), "")
		.replace(new RegExp(ESCAPE + "\\]8;;[^" + BELL + "]*" + BELL, "g"), "");
}

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
		const text = "*|*|*|Name^*||*^Age^*||*^*|*|*|\n*|*|*|Alice^*||*^30^*||*^*|*|*|";
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
		const markdown = "| Name | Age | City |\n|------|-----|------|\n| Alice | 30 | Ottawa |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
		assert.ok(result.includes("Name"));
		assert.ok(result.includes("Alice"));
		assert.ok(result.includes("Ottawa"));
	});

	it("renders a table with multiple rows", () => {
		const markdown = "| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |\n| Carol | 35 |";
		const result = parseMarkdown(markdown);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Alice"));
		assert.ok(result.includes("Bob"));
		assert.ok(result.includes("Carol"));
	});

	it("renders a table with special characters", () => {
		const markdown = "| Item | Value |\n|------|-------|\n| Score | 100% |\n| Note | Good! |";
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
		const markdown = "| Name | Age |\n|------|-----|\n| Alice | 30 |\n\nSome text after.";
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

describe("parseMarkdown - heading rendering", () => {
	it("renders h1 with prefix", () => {
		const result = parseMarkdown("# Hello");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Hello"));
		assert.ok(stripped.startsWith("# "));
	});

	it("renders h2 with prefix", () => {
		const result = parseMarkdown("## World");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("World"));
		assert.ok(stripped.startsWith("## "));
	});

	it("renders h3 with prefix", () => {
		const result = parseMarkdown("### Deep");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Deep"));
		assert.ok(stripped.startsWith("### "));
	});

	it("renders nested headings", () => {
		const result = parseMarkdown("# Title\n\n## Subtitle");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Title"));
		assert.ok(stripped.includes("Subtitle"));
		assert.ok(stripped.startsWith("# Title"));
	});
});

describe("parseMarkdown - bold and italic", () => {
	it("renders bold text", () => {
		const result = parseMarkdown("**bold**");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("bold"));
	});

	it("renders italic text", () => {
		const result = parseMarkdown("*italic*");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("italic"));
	});

	it("renders bold and italic together", () => {
		const result = parseMarkdown("***bold italic***");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("bold italic"));
	});

	it("renders bold in paragraph", () => {
		const result = parseMarkdown("This is **bold** text");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("This is"));
		assert.ok(stripped.includes("bold"));
		assert.ok(stripped.includes("text"));
	});
});

describe("parseMarkdown - inline code", () => {
	it("renders inline code", () => {
		const result = parseMarkdown("Use `foo()` here");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("foo()"));
		assert.ok(stripped.includes("Use"));
		assert.ok(stripped.includes("here"));
	});

	it("renders inline code with special chars", () => {
		const result = parseMarkdown("Call `a.b.c()`");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("a.b.c()"));
	});
});

describe("parseMarkdown - code blocks", () => {
	it("renders fenced code block", () => {
		const result = parseMarkdown("```js\nconsole.log('hi');\n```");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("console.log"));
		assert.ok(stripped.includes("hi"));
	});

	it("renders code block without language", () => {
		const result = parseMarkdown("```\nplain code\n```");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("plain code"));
	});

	it("renders code block with different language", () => {
		const result = parseMarkdown("```python\nprint('hello')\n```");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("print"));
		assert.ok(stripped.includes("hello"));
	});
});

describe("parseMarkdown - blockquotes", () => {
	it("renders a blockquote", () => {
		const result = parseMarkdown("> This is a quote");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("This is a quote"));
	});

	it("renders nested blockquotes", () => {
		const result = parseMarkdown(">> Nested quote");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Nested quote"));
	});

	it("renders multi-line blockquote", () => {
		const result = parseMarkdown("> Line one\n> Line two");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Line one"));
		assert.ok(stripped.includes("Line two"));
	});
});

describe("parseMarkdown - unordered lists", () => {
	it("renders a simple unordered list", () => {
		const result = parseMarkdown("- item one\n- item two\n- item three");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("item one"));
		assert.ok(stripped.includes("item two"));
		assert.ok(stripped.includes("item three"));
	});

	it("renders unordered list with asterisk bullets", () => {
		const result = parseMarkdown("* alpha\n* beta\n* gamma");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("alpha"));
		assert.ok(stripped.includes("beta"));
		assert.ok(stripped.includes("gamma"));
	});

	it("renders unordered list with plus bullets", () => {
		const result = parseMarkdown("+ one\n+ two");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("one"));
		assert.ok(stripped.includes("two"));
	});

	it("renders list with bold items", () => {
		const result = parseMarkdown("- **bold** item\n- normal item");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("bold"));
		assert.ok(stripped.includes("normal"));
	});
});

describe("parseMarkdown - ordered lists", () => {
	it("renders an ordered list", () => {
		const result = parseMarkdown("1. first\n2. second\n3. third");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("first"));
		assert.ok(stripped.includes("second"));
		assert.ok(stripped.includes("third"));
	});

	it("renders ordered list with gaps", () => {
		const result = parseMarkdown("1. one\n5. five\n10. ten");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("one"));
		assert.ok(stripped.includes("five"));
		assert.ok(stripped.includes("ten"));
	});
});

describe("parseMarkdown - links", () => {
	it("renders inline link", () => {
		const result = parseMarkdown("Check [GitHub](https://github.com)");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("GitHub"));
	});

	it("renders bare URL", () => {
		const result = parseMarkdown("Visit https://example.com");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("https://example.com"));
	});

	it("renders link with title", () => {
		const result = parseMarkdown('[Link](https://example.com "Title")');
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Link"));
	});
});

describe("parseMarkdown - horizontal rule", () => {
	it("renders a horizontal rule", () => {
		const result = parseMarkdown("---");
		// In non-TTY environments (tests), process.stdout.columns is undefined,
		// so hr() returns an empty string. This is expected — hr() only renders
		// in a real terminal where stdout.columns is available.
		assert.ok(typeof result === "string");
	});

	it("renders horizontal rule with asterisks", () => {
		const result = parseMarkdown("***");
		// Same TTY dependency as ---
		assert.ok(typeof result === "string");
	});
});

describe("parseMarkdown - strikethrough", () => {
	it("renders strikethrough text", () => {
		const result = parseMarkdown("~~deleted~~");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("deleted"));
	});
});

describe("parseMarkdown - mixed content", () => {
	it("renders a complex document with multiple elements", () => {
		const markdown = [
			"# Title",
			"",
			"Paragraph with **bold** and *italic* and `code`.",
			"",
			"> A blockquote",
			"",
			"- item 1",
			"- item 2",
			"",
			"1. ordered 1",
			"2. ordered 2",
			"",
			"[Link](https://example.com)",
			"",
			"---",
			"",
			"~~strikethrough~~",
		].join("\n");
		const result = parseMarkdown(markdown);
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Title"));
		assert.ok(stripped.includes("bold"));
		assert.ok(stripped.includes("italic"));
		assert.ok(stripped.includes("code"));
		assert.ok(stripped.includes("A blockquote"));
		assert.ok(stripped.includes("item 1"));
		assert.ok(stripped.includes("item 2"));
		assert.ok(stripped.includes("ordered 1"));
		assert.ok(stripped.includes("ordered 2"));
		assert.ok(stripped.includes("Link"));
		assert.ok(stripped.includes("example.com"));
		assert.ok(stripped.includes("strikethrough"));
	});

	it("renders paragraph with HTML entity", () => {
		const result = parseMarkdown("5 &lt; 10");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("5 < 10"));
	});

	it("renders paragraph with ampersand", () => {
		const result = parseMarkdown("Tom & Jerry");
		const stripped = stripAnsi(result);
		assert.ok(stripped.includes("Tom & Jerry"));
	});
});
