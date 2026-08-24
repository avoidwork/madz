/**
 * Tests for the PPTX creation tool.
 * @module tests/unit/tools/pptx
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	createPptx,
	pptxCreateSchema,
	validateImagePath,
	validateOutputPath,
	validateTemplatePath,
	createTextRuns,
	shrinkToFit,
} from "../../../src/tools/fileCreate/pptx.js";

const TMP_DIR = join(process.cwd(), "tmp", "pptx-tests");

async function ensureTmpDir() {
	const { mkdir } = await import("node:fs/promises");
	await mkdir(TMP_DIR, { recursive: true });
}

async function cleanupTmp() {
	await rm(TMP_DIR, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("pptxCreateSchema", () => {
	it("validates a minimal presentation input", () => {
		const result = pptxCreateSchema.safeParse({
			outputPath: join(TMP_DIR, "test.pptx"),
			slides: [{ title: "Hello" }],
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects missing outputPath", () => {
		const result = pptxCreateSchema.safeParse({ slides: [] });
		assert.strictEqual(result.success, false);
	});

	it("rejects missing slides", () => {
		const result = pptxCreateSchema.safeParse({ outputPath: "/tmp/test.pptx" });
		assert.strictEqual(result.success, false);
	});

	it("rejects invalid hex color", () => {
		const result = pptxCreateSchema.safeParse({
			outputPath: join(TMP_DIR, "test.pptx"),
			slides: [{ backgroundColor: "not-a-color" }],
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts all layout types", () => {
		const layouts = ["title", "content", "two-column", "comparison", "quote", "image-only"];
		for (const layout of layouts) {
			const result = pptxCreateSchema.safeParse({
				outputPath: join(TMP_DIR, "test.pptx"),
				slides: [{ layout, title: "Test" }],
			});
			assert.strictEqual(result.success, true, `Layout ${layout} should be valid`);
		}
	});

	it("defaults layout to content when omitted", () => {
		const result = pptxCreateSchema.safeParse({
			outputPath: join(TMP_DIR, "test.pptx"),
			slides: [{ title: "Test" }],
		});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data?.slides[0].layout, "content");
	});
});

// ---------------------------------------------------------------------------
// Validation helper tests
// ---------------------------------------------------------------------------

describe("validateImagePath", () => {
	it("accepts valid PNG path", () => {
		const result = validateImagePath("/path/to/image.png");
		assert.strictEqual(result.valid, true);
	});

	it("accepts valid JPEG path", () => {
		const result = validateImagePath("/path/to/image.jpg");
		assert.strictEqual(result.valid, true);
	});

	it("accepts valid GIF path", () => {
		const result = validateImagePath("/path/to/image.gif");
		assert.strictEqual(result.valid, true);
	});

	it("rejects unsupported format", () => {
		const result = validateImagePath("/path/to/image.webp");
		assert.strictEqual(result.valid, false);
		assert.ok(result.error?.includes("Unsupported"));
	});

	it("rejects missing extension", () => {
		const result = validateImagePath("/path/to/noext");
		assert.strictEqual(result.valid, false);
	});
});

describe("validateOutputPath", () => {
	it("accepts valid path within allowed directory", () => {
		const result = validateOutputPath("/tmp/test.pptx", "/tmp");
		assert.strictEqual(result.valid, true);
	});

	it("rejects path traversal attempt", () => {
		const result = validateOutputPath("/tmp/../../../etc/passwd", "/tmp");
		assert.strictEqual(result.valid, false);
		assert.ok(result.error?.includes("outside allowed directory"));
	});

	it("rejects path outside allowed directory", () => {
		const result = validateOutputPath("/etc/passwd", "/tmp");
		assert.strictEqual(result.valid, false);
	});
});

describe("validateTemplatePath", () => {
	it("rejects non-ZIP file", async () => {
		const testFile = join(TMP_DIR, "not-a-pptx.txt");
		await writeFile(testFile, "not a pptx");
		const result = await validateTemplatePath(testFile);
		assert.strictEqual(result.valid, false);
		assert.ok(result.error?.includes("not a valid PPTX"));
		await rm(testFile, { force: true });
	});

	it("rejects non-existent file", async () => {
		const result = await validateTemplatePath("/nonexistent/file.pptx");
		assert.strictEqual(result.valid, false);
	});
});

// ---------------------------------------------------------------------------
// Text helper tests
// ---------------------------------------------------------------------------

describe("createTextRuns", () => {
	it("creates runs for single line", () => {
		const runs = createTextRuns("Hello");
		assert.strictEqual(runs.length, 1);
		assert.strictEqual(runs[0].text, "Hello");
	});

	it("creates runs for multi-line text", () => {
		const runs = createTextRuns("Line 1\nLine 2\nLine 3");
		assert.strictEqual(runs.length, 3);
		assert.strictEqual(runs[0].text, "Line 1");
		assert.strictEqual(runs[1].text, "Line 2");
		assert.strictEqual(runs[2].text, "Line 3");
	});

	it("returns empty array for empty string", () => {
		const runs = createTextRuns("");
		assert.strictEqual(runs.length, 0);
	});

	it("passes through formatting options", () => {
		const runs = createTextRuns("Hello", { bold: true, fontSize: 24 });
		assert.strictEqual(runs[0].options.bold, true);
		assert.strictEqual(runs[0].options.fontSize, 24);
	});
});

describe("shrinkToFit", () => {
	it("returns text unchanged when it fits", () => {
		const result = shrinkToFit("Short", 10, 44);
		assert.strictEqual(result.options.fontSize, 44);
	});

	it("reduces font size for long text", () => {
		const longText = "a".repeat(200);
		const result = shrinkToFit(longText, 5, 44);
		assert.ok(result.options.fontSize <= 44);
		assert.ok(result.options.fontSize >= 6);
	});
});

// ---------------------------------------------------------------------------
// Integration tests (actual PPTX generation)
// ---------------------------------------------------------------------------

describe("createPptx", () => {
	before(async () => {
		await ensureTmpDir();
	});

	after(async () => {
		await cleanupTmp();
	});

	it("creates a presentation with a title slide", async () => {
		const outputPath = join(TMP_DIR, "title-slide.pptx");
		const result = await createPptx({
			outputPath,
			slides: [{ layout: "title", title: "My Title", subtitle: "My Subtitle" }],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.slideCount, 1);

		// Verify file exists and is a valid ZIP
		const data = await readFile(outputPath);
		assert.strictEqual(data[0], 0x50); // PK
		assert.strictEqual(data[1], 0x4b);
	});

	it("creates a presentation with a content slide", async () => {
		const outputPath = join(TMP_DIR, "content-slide.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					layout: "content",
					title: "Content Slide",
					content: "Bullet 1\nBullet 2\nBullet 3",
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("creates a presentation with multiple slides", async () => {
		const outputPath = join(TMP_DIR, "multi-slide.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{ layout: "title", title: "Slide 1" },
				{ layout: "content", title: "Slide 2", content: "Content" },
				{ layout: "quote", quote: "A quote", quoteAttribution: "Author" },
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.slideCount, 3);
	});

	it("creates a presentation with an empty slides array", async () => {
		const outputPath = join(TMP_DIR, "empty-slides.pptx");
		const result = await createPptx({
			outputPath,
			slides: [],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.slideCount, 1);
	});

	it("creates a presentation with a table", async () => {
		const outputPath = join(TMP_DIR, "with-table.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					title: "Table Slide",
					tables: [
						{
							headers: ["Name", "Value"],
							rows: [
								["Alice", "100"],
								["Bob", "200"],
							],
						},
					],
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("rejects output path outside allowed directory", async () => {
		const result = await createPptx({
			outputPath: "/etc/passwd.pptx",
			slides: [{ title: "Test" }],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error?.includes("outside allowed directory"));
	});

	it("rejects unsupported image format", async () => {
		const result = await createPptx({
			outputPath: join(TMP_DIR, "bad-image.pptx"),
			slides: [
				{
					images: [{ path: "/path/to/image.webp", x: 0, y: 0, w: 1, h: 1 }],
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error?.includes("Unsupported image format"));
	});

	it("rejects invalid template file", async () => {
		const badTemplate = join(TMP_DIR, "bad-template.pptx");
		await writeFile(badTemplate, "not a pptx");
		const result = await createPptx({
			outputPath: join(TMP_DIR, "with-bad-template.pptx"),
			templatePath: badTemplate,
			slides: [{ title: "Test" }],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error?.includes("not a valid PPTX"));
		await rm(badTemplate, { force: true });
	});

	it("generates a valid PPTX file (ZIP structure)", async () => {
		const outputPath = join(TMP_DIR, "valid.pptx");
		await createPptx({
			outputPath,
			slides: [
				{
					layout: "title",
					title: "Valid PPTX",
					subtitle: "Generated by tests",
				},
			],
		});

		const data = await readFile(outputPath);
		// ZIP magic bytes
		assert.strictEqual(data[0], 0x50);
		assert.strictEqual(data[1], 0x4b);
		// Should contain [Content_Types].xml
		const content = data.toString("utf-8");
		assert.ok(content.includes("[Content_Types]"));
	});

	it("supports custom slide dimensions", async () => {
		const outputPath = join(TMP_DIR, "custom-dims.pptx");
		const result = await createPptx({
			outputPath,
			slideWidth: 10,
			slideHeight: 8,
			slides: [{ title: "Custom" }],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles text with formatting options", async () => {
		const outputPath = join(TMP_DIR, "formatted.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					title: "Formatted",
					content: "Bold line\nItalic line",
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles quote layout", async () => {
		const outputPath = join(TMP_DIR, "quote.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					layout: "quote",
					quote: "To be or not to be",
					quoteAttribution: "Hamlet",
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles two-column layout", async () => {
		const outputPath = join(TMP_DIR, "two-column.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					layout: "two-column",
					title: "Two Columns",
					content: "Left content\nRight content",
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles comparison layout", async () => {
		const outputPath = join(TMP_DIR, "comparison.pptx");
		const result = await createPptx({
			outputPath,
			slides: [
				{
					layout: "comparison",
					title: "Comparison",
					content: "Before\nAfter",
				},
			],
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});
});
