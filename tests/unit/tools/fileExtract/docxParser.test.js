/**
 * Tests for the DOCX parser.
 * @see {@link src/tools/fileExtract/docxParser.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { docxToMarkdown, extractDocxTables } from "../../../../src/tools/fileExtract/docxParser.js";

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function wrapBody(bodyContent) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}>
<w:body>${bodyContent}</w:body>
</w:document>`;
}

function p(text, extras) {
	return `<w:p>${extras || ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function heading(text, level) {
	return `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function listItem(text) {
	return `<w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function formattedRun(text, fmt) {
	let rPr = "";
	if (fmt.bold) rPr += "<w:b/>";
	if (fmt.italic) rPr += "<w:i/>";
	if (fmt.code) rPr += "<w:u/>";
	return `<w:r><w:rPr>${rPr}</w:rPr><w:t>${text}</w:t></w:r>`;
}

describe("docxToMarkdown", () => {
	it("should return empty string for null input", async () => {
		assert.strictEqual(await docxToMarkdown(null), "");
	});

	it("should return empty string for empty input", async () => {
		assert.strictEqual(await docxToMarkdown(""), "");
	});

	it("should return empty string for whitespace-only input", async () => {
		assert.strictEqual(await docxToMarkdown("   "), "");
	});

	it("should return empty string for empty body", async () => {
		const xml = wrapBody("");
		assert.strictEqual(await docxToMarkdown(xml), "");
	});

	it("should parse a basic paragraph", async () => {
		const xml = wrapBody(p("Hello"));
		assert.strictEqual(await docxToMarkdown(xml), "Hello");
	});

	it("should parse heading levels 1-6", async () => {
		const xml = wrapBody(
			heading("H1", 1) +
				heading("H2", 2) +
				heading("H3", 3) +
				heading("H4", 4) +
				heading("H5", 5) +
				heading("H6", 6),
		);
		assert.strictEqual(
			await docxToMarkdown(xml),
			"# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6",
		);
	});

	it("should parse Title as heading level 1", async () => {
		const xml = wrapBody(
			`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>`,
		);
		assert.strictEqual(await docxToMarkdown(xml), "# Title");
	});

	it("should parse Subtitle as heading level 2", async () => {
		const xml = wrapBody(
			`<w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>Sub</w:t></w:r></w:p>`,
		);
		assert.strictEqual(await docxToMarkdown(xml), "## Sub");
	});

	it("should handle bold formatting", async () => {
		const xml = wrapBody(`<w:p>${formattedRun("bold", { bold: true })}</w:p>`);
		assert.strictEqual(await docxToMarkdown(xml), "**bold**");
	});

	it("should handle italic formatting", async () => {
		const xml = wrapBody(`<w:p>${formattedRun("italic", { italic: true })}</w:p>`);
		assert.strictEqual(await docxToMarkdown(xml), "_italic_");
	});

	it("should handle bold+italic formatting", async () => {
		const xml = wrapBody(`<w:p>${formattedRun("both", { bold: true, italic: true })}</w:p>`);
		assert.strictEqual(await docxToMarkdown(xml), "**_both___");
	});

	it("should handle code (underline) formatting", async () => {
		const xml = wrapBody(`<w:p>${formattedRun("code", { code: true })}</w:p>`);
		assert.strictEqual(await docxToMarkdown(xml), "`code`");
	});

	it("should handle list items", async () => {
		const xml = wrapBody(listItem("Item 1") + listItem("Item 2"));
		assert.strictEqual(await docxToMarkdown(xml), "- Item 1\n- Item 2");
	});

	it("should close list when heading appears", async () => {
		const xml = wrapBody(listItem("Item") + heading("Head", 2));
		assert.strictEqual(await docxToMarkdown(xml), "- Item\n\n## Head");
	});

	it("should close list when paragraph appears", async () => {
		const xml = wrapBody(listItem("Item") + p("Text"));
		assert.strictEqual(await docxToMarkdown(xml), "- Item\n\nText");
	});

	it("should handle mixed content", async () => {
		const xml = wrapBody(heading("Title", 1) + p("Para") + listItem("Li1") + listItem("Li2"));
		assert.strictEqual(await docxToMarkdown(xml), "# Title\n\nPara\n\n- Li1\n- Li2");
	});

	it("should skip empty text paragraphs", async () => {
		const xml = wrapBody(p("") + p("A") + p(""));
		assert.strictEqual(await docxToMarkdown(xml), "A");
	});

	it("should handle malformed XML with fallback regex", async () => {
		const xml = "<broken>Some <text>here</text>";
		const result = await docxToMarkdown(xml);
		assert.ok(result.includes("Some"));
		assert.ok(result.includes("here"));
	});

	it("should handle non-heading pStyle values", async () => {
		const xml = wrapBody(
			`<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>Normal</w:t></w:r></w:p>`,
		);
		assert.strictEqual(await docxToMarkdown(xml), "Normal");
	});

	it("should handle pStyle as object with _ property", async () => {
		// When explicitArray is false, a single element is not an array
		const xml = wrapBody(
			`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>H</w:t></w:r></w:p>`,
		);
		assert.strictEqual(await docxToMarkdown(xml), "# H");
	});
});

describe("extractDocxTables", () => {
	it("should return empty string for null input", async () => {
		assert.strictEqual(await extractDocxTables(null), "");
	});

	it("should return empty string for empty input", async () => {
		assert.strictEqual(await extractDocxTables(""), "");
	});

	it("should return empty string for empty body", async () => {
		const xml = wrapBody("");
		assert.strictEqual(await extractDocxTables(xml), "");
	});

	it("should extract a basic table", async () => {
		const xml = wrapBody(
			`<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr>` +
				`<w:tr><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,
		);
		const result = await extractDocxTables(xml);
		assert.ok(result.includes("| A | B |"));
		assert.ok(result.includes("| 1 | 2 |"));
	});

	it("should extract multiple tables", async () => {
		const table1 = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>X</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
		const table2 = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Y</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
		const xml = wrapBody(table1 + table2);
		const result = await extractDocxTables(xml);
		assert.ok(result.includes("X"));
		assert.ok(result.includes("Y"));
	});

	it("should handle empty table (no rows)", async () => {
		const xml = wrapBody(`<w:tbl></w:tbl>`);
		assert.strictEqual(await extractDocxTables(xml), "");
	});

	it("should handle malformed XML", async () => {
		const xml = "<broken>text</broken>";
		assert.strictEqual(await extractDocxTables(xml), "");
	});

	it("should handle table with empty cells", async () => {
		const xml = wrapBody(
			`<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t/></w:r></w:p></w:tc></w:tr></w:tbl>`,
		);
		const result = await extractDocxTables(xml);
		assert.ok(result.includes("A"));
	});
});
