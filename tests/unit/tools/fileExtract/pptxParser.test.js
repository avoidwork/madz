/**
 * Tests for the PPTX parser.
 * @see {@link src/tools/fileExtract/pptxParser.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { pptxToMarkdown } from "../../../../src/tools/fileExtract/pptxParser.js";

const P_NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

function slideXml(bodyContent) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:slide ${P_NS} ${A_NS}>
<p:spTree>${bodyContent}</p:spTree>
</p:slide>`;
}

function shape(name, text) {
	return `<p:sp><p:nvSpPr><p:cNvPr name="${name}"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function notesSlideXml(bodyContent) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesSlide ${P_NS} ${A_NS}>
<p:spTree>${bodyContent}</p:spTree>
</p:notesSlide>`;
}

describe("pptxToMarkdown", () => {
	it("should throw TypeError for null input", async () => {
		await assert.rejects(() => pptxToMarkdown(null), TypeError);
	});

	it("should return empty string for empty Map", async () => {
		assert.strictEqual(await pptxToMarkdown(new Map()), "");
	});

	it("should parse a single slide with title and bullets", async () => {
		const content = new Map();
		content.set(
			"ppt/slides/slide1.xml",
			slideXml(shape("title", "My Title") + shape("", "Bullet 1") + shape("", "Bullet 2")),
		);
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("# My Title"));
		assert.ok(result.includes("- Bullet 1"));
		assert.ok(result.includes("- Bullet 2"));
	});

	it("should parse multiple slides with separators", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", slideXml(shape("title", "Slide 1")));
		content.set("ppt/slides/slide2.xml", slideXml(shape("title", "Slide 2")));
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("# Slide 1"));
		assert.ok(result.includes("# Slide 2"));
	});

	it("should fall back to ## Slide N when no title shape", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", slideXml(shape("", "Content")));
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("## Slide 1"));
		assert.ok(result.includes("- Content"));
	});

	it("should extract speaker notes", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", slideXml(shape("title", "Title")));
		content.set("ppt/slideNotesSlides/notesSlide1.xml", notesSlideXml(shape("", "Note text")));
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("# Title"));
		assert.ok(result.includes("Speaker Notes"));
		assert.ok(result.includes("Note text"));
	});

	it("should handle malformed slide XML with parse error fallback", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", "<broken>xml<unclosed>");
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("Slide 1 (parse error)"));
	});

	it("should ignore non-slide entries", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", slideXml(shape("title", "Real")));
		content.set("ppt/presentation.xml", "<xml/>");
		content.set("[Content_Types].xml", "<xml/>");
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("Real"));
		assert.ok(!result.includes("presentation"));
	});

	it("should sort slides numerically", async () => {
		const content = new Map();
		content.set("ppt/slides/slide10.xml", slideXml(shape("title", "Slide 10")));
		content.set("ppt/slides/slide2.xml", slideXml(shape("title", "Slide 2")));
		content.set("ppt/slides/slide1.xml", slideXml(shape("title", "Slide 1")));
		const result = await pptxToMarkdown(content);
		const idx1 = result.indexOf("Slide 1");
		const idx2 = result.indexOf("Slide 2");
		const idx10 = result.indexOf("Slide 10");
		assert.ok(idx1 < idx2);
		assert.ok(idx2 < idx10);
	});

	it("should handle shape with no text (empty txBody)", async () => {
		const content = new Map();
		content.set(
			"ppt/slides/slide1.xml",
			`<?xml version="1.0"?><p:slide ${P_NS} ${A_NS}><p:spTree><p:sp><p:nvSpPr><p:cNvPr name="title"/></p:nvSpPr><p:txBody><a:p><a:r><a:t></a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:slide>`,
		);
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("## Slide 1"));
	});

	it("should handle shape with txBody but no a:p", async () => {
		const content = new Map();
		content.set(
			"ppt/slides/slide1.xml",
			`<?xml version="1.0"?><p:slide ${P_NS} ${A_NS}><p:spTree><p:sp><p:nvSpPr><p:cNvPr name="title"/></p:nvSpPr><p:txBody></p:txBody></p:sp></p:spTree></p:slide>`,
		);
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("## Slide 1"));
	});

	it("should handle slide with no spTree", async () => {
		const content = new Map();
		content.set(
			"ppt/slides/slide1.xml",
			`<?xml version="1.0"?><p:slide ${P_NS} ${A_NS}></p:slide>`,
		);
		const result = await pptxToMarkdown(content);
		assert.strictEqual(result, "");
	});

	it("should handle speaker notes parse error gracefully", async () => {
		const content = new Map();
		content.set("ppt/slides/slide1.xml", slideXml(shape("title", "Title")));
		content.set("ppt/slideNotesSlides/notesSlide1.xml", "<broken>notes</broken>");
		const result = await pptxToMarkdown(content);
		assert.ok(result.includes("# Title"));
	});
});
