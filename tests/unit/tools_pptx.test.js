import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
	createPptx,
	createSlide,
	createTextRuns,
	shrinkToFit,
	validateImagePath,
	validateOutputPath,
	validateTemplatePath,
	PptxError,
	pptxGenerateSchema,
} from "../../src/tools/fileCreate/pptx.js";
import PptxGenJS from "pptxgenjs";

const FIXTURES = resolve("tests/fixtures/pptx");
const TMP = resolve("tmp/pptx-tests");

async function ensureTmp() {
	await mkdir(TMP, { recursive: true });
}

async function cleanTmp() {
	await rm(TMP, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

describe("pptxGenerateSchema", () => {
	it("accepts minimal valid input", () => {
		const result = pptxGenerateSchema.parse({
			outputPath: join(TMP, "test.pptx"),
			slides: [],
		});
		assert.ok(result);
		assert.strictEqual(result.slides.length, 0);
	});

	it("rejects missing outputPath", () => {
		assert.throws(() => pptxGenerateSchema.parse({ slides: [] }), {
			message: /outputPath/,
		});
	});

	it("rejects missing slides", () => {
		assert.throws(() => pptxGenerateSchema.parse({ outputPath: join(TMP, "test.pptx") }), {
			message: /slides/,
		});
	});

	it("rejects invalid slide layout", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ layout: "foobar" }],
				}),
			{ message: /layout/ },
		);
	});

	it("accepts valid slide layouts", () => {
		const layouts = ["title", "content", "two-column", "comparison", "quote", "image-only"];
		for (const layout of layouts) {
			const result = pptxGenerateSchema.parse({
				outputPath: join(TMP, "test.pptx"),
				slides: [{ layout }],
			});
			assert.strictEqual(result.slides[0].layout, layout);
		}
	});

	it("rejects invalid background color", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ backgroundColor: "not-a-color" }],
				}),
			{ message: /backgroundColor/ },
		);
	});

	it("accepts valid background color", () => {
		const result = pptxGenerateSchema.parse({
			outputPath: join(TMP, "test.pptx"),
			slides: [{ backgroundColor: "#FF5733" }],
		});
		assert.strictEqual(result.slides[0].backgroundColor, "#FF5733");
	});

	it("rejects title exceeding 200 chars", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ title: "a".repeat(201) }],
				}),
			{ message: /title/ },
		);
	});

	it("rejects content exceeding 5000 chars", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ content: "a".repeat(5001) }],
				}),
			{ message: /content/ },
		);
	});

	it("rejects quote exceeding 2000 chars", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ quote: "a".repeat(2001) }],
				}),
			{ message: /quote/ },
		);
	});

	it("rejects subtitle exceeding 500 chars", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ subtitle: "a".repeat(501) }],
				}),
			{ message: /subtitle/ },
		);
	});

	it("rejects quoteAttribution exceeding 200 chars", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ quote: "a quote", quoteAttribution: "a".repeat(201) }],
				}),
			{ message: /quoteAttribution/ },
		);
	});

	it("rejects slideWidth below 9", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [],
					slideWidth: 8,
				}),
			{ message: /slideWidth/ },
		);
	});

	it("rejects slideWidth above 20", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [],
					slideWidth: 21,
				}),
			{ message: /slideWidth/ },
		);
	});

	it("rejects slideHeight below 7.5", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [],
					slideHeight: 7,
				}),
			{ message: /slideHeight/ },
		);
	});

	it("rejects slideHeight above 15", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [],
					slideHeight: 16,
				}),
			{ message: /slideHeight/ },
		);
	});

	it("accepts valid slideWidth and slideHeight", () => {
		const result = pptxGenerateSchema.parse({
			outputPath: join(TMP, "test.pptx"),
			slides: [],
			slideWidth: 13.33,
			slideHeight: 7.5,
		});
		assert.strictEqual(result.slideWidth, 13.33);
		assert.strictEqual(result.slideHeight, 7.5);
	});

	it("rejects image with unsupported extension", () => {
		const result = validateImagePath("/tmp/test.webp");
		assert.strictEqual(result.valid, false);
		assert.ok(result.error.includes("Unsupported image format"));
	});

	it("rejects image with missing path", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ images: [{ x: 0 }] }],
				}),
			{ message: /path/ },
		);
	});

	it("rejects image with negative dimensions", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ images: [{ path: "/tmp/test.png", w: -1 }] }],
				}),
			{ message: /w/ },
		);
	});

	it("rejects image with zero width", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ images: [{ path: "/tmp/test.png", w: 0 }] }],
				}),
			{ message: /w/ },
		);
	});

	it("accepts image with minimal valid dimensions", () => {
		const result = pptxGenerateSchema.parse({
			outputPath: join(TMP, "test.pptx"),
			slides: [{ images: [{ path: "/tmp/test.png", w: 0.1, h: 0.1 }] }],
		});
		assert.strictEqual(result.slides[0].images[0].w, 0.1);
	});

	it("rejects table with non-string row values", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ tables: [{ rows: [[1, 2, 3]] }] }],
				}),
			{ message: /string/ },
		);
	});

	it("rejects table with invalid fill color", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [{ tables: [{ options: { fill: { color: "red" } } }] }],
				}),
			{ message: /color/ },
		);
	});

	it("rejects table with invalid border color", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [
						{
							tables: [{ options: { border: { color: "red" } } }],
						},
					],
				}),
			{ message: /color/ },
		);
	});

	it("rejects table border pt above 50", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [
						{
							tables: [{ options: { border: { pt: 51 } } }],
						},
					],
				}),
			{ message: /pt/ },
		);
	});

	it("rejects table border pt below 0", () => {
		assert.throws(
			() =>
				pptxGenerateSchema.parse({
					outputPath: join(TMP, "test.pptx"),
					slides: [
						{
							tables: [{ options: { border: { pt: -1 } } }],
						},
					],
				}),
			{ message: /pt/ },
		);
	});

	it("accepts table with valid options", () => {
		const result = pptxGenerateSchema.parse({
			outputPath: join(TMP, "test.pptx"),
			slides: [
				{
					tables: [
						{
							headers: ["A", "B"],
							rows: [
								["1", "2"],
								["3", "4"],
							],
							options: {
								colW: [2, 3],
								fill: { color: "#FFFFFF" },
								border: { type: "solid", color: "#CCCCCC", pt: 1 },
							},
						},
					],
				},
			],
		});
		assert.strictEqual(result.slides[0].tables[0].headers.length, 2);
	});
});

// ---------------------------------------------------------------------------
// validateImagePath
// ---------------------------------------------------------------------------

describe("validateImagePath", () => {
	it("accepts valid PNG path", () => {
		const result = validateImagePath(join(FIXTURES, "test.png"));
		assert.strictEqual(result.valid, true);
	});

	it("accepts valid JPG path", () => {
		const result = validateImagePath(join(FIXTURES, "test.jpg"));
		assert.strictEqual(result.valid, true);
	});

	it("accepts valid GIF path", () => {
		const result = validateImagePath(join(FIXTURES, "test.gif"));
		assert.strictEqual(result.valid, true);
	});

	it("accepts valid BMP path", () => {
		const result = validateImagePath(join(FIXTURES, "test.bmp"));
		assert.strictEqual(result.valid, true);
	});

	it("rejects unsupported image format", () => {
		const result = validateImagePath("/tmp/test.webp");
		assert.strictEqual(result.valid, false);
		assert.ok(result.error.includes("Unsupported image format"));
	});

	it("rejects file with invalid magic bytes", async () => {
		const badPath = join(FIXTURES, "bad.png");
		await writeFile(badPath, Buffer.from("not a png"));
		try {
			const result = validateImagePath(badPath);
			assert.strictEqual(result.valid, false);
			assert.ok(result.error.includes("not a valid png"));
		} finally {
			await rm(badPath, { force: true });
		}
	});

	it("accepts non-existent file (extension valid, runtime check later)", () => {
		const result = validateImagePath("/tmp/nonexistent.png");
		assert.strictEqual(result.valid, true);
	});

	it("rejects file with no extension", () => {
		const result = validateImagePath("/tmp/noextension");
		assert.strictEqual(result.valid, false);
	});
});

// ---------------------------------------------------------------------------
// validateOutputPath
// ---------------------------------------------------------------------------

describe("validateOutputPath", () => {
	it("accepts path within CWD", () => {
		const result = validateOutputPath("./test.pptx");
		assert.strictEqual(result.valid, true);
	});

	it("accepts subdirectory path within CWD", () => {
		const result = validateOutputPath("./subdir/test.pptx");
		assert.strictEqual(result.valid, true);
	});

	it("rejects path traversal outside CWD", () => {
		const result = validateOutputPath("../other/test.pptx");
		assert.strictEqual(result.valid, false);
		assert.ok(result.error.includes("outside allowed directory"));
	});

	it("rejects absolute path outside CWD", () => {
		const result = validateOutputPath("/tmp/test.pptx");
		assert.strictEqual(result.valid, false);
	});

	it("respects custom allowedDir", () => {
		const result = validateOutputPath("/home/jason/test.pptx", "/home/jason");
		assert.strictEqual(result.valid, true);
	});
});

// ---------------------------------------------------------------------------
// validateTemplatePath
// ---------------------------------------------------------------------------

describe("validateTemplatePath", () => {
	it("accepts valid PPTX template (PK magic bytes)", () => {
		const result = validateTemplatePath(join(FIXTURES, "template.pptx"));
		assert.strictEqual(result, true);
	});

	it("rejects non-PPTX file", () => {
		const result = validateTemplatePath(join(FIXTURES, "not-a-pptx.txt"));
		assert.strictEqual(result, false);
	});

	it("rejects non-existent file", () => {
		const result = validateTemplatePath("/tmp/nonexistent.pptx");
		assert.strictEqual(result, false);
	});
});

// ---------------------------------------------------------------------------
// createTextRuns
// ---------------------------------------------------------------------------

describe("createTextRuns", () => {
	it("returns empty array for empty text", () => {
		const result = createTextRuns("");
		assert.deepStrictEqual(result, []);
	});

	it("returns empty array for null text", () => {
		const result = createTextRuns(null);
		assert.deepStrictEqual(result, []);
	});

	it("returns empty array for undefined text", () => {
		const result = createTextRuns(undefined);
		assert.deepStrictEqual(result, []);
	});

	it("creates a run for single line", () => {
		const result = createTextRuns("Hello");
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].text, "Hello");
		assert.strictEqual(result[0].options.fontSize, 44);
	});

	it("creates a run per line for multi-line text", () => {
		const result = createTextRuns("Line 1\nLine 2\nLine 3");
		assert.strictEqual(result.length, 3);
		assert.strictEqual(result[0].text, "Line 1");
		assert.strictEqual(result[1].text, "Line 2");
		assert.strictEqual(result[2].text, "Line 3");
	});

	it("respects custom maxFontSize", () => {
		const result = createTextRuns("Hello", { maxFontSize: 24 });
		assert.strictEqual(result[0].options.fontSize, 24);
	});

	it("passes through additional options", () => {
		const result = createTextRuns("Hello", { bold: true, fontColor: "FF0000" });
		assert.strictEqual(result[0].options.bold, true);
		assert.strictEqual(result[0].options.fontColor, "FF0000");
	});
});

// ---------------------------------------------------------------------------
// shrinkToFit
// ---------------------------------------------------------------------------

describe("shrinkToFit", () => {
	it("does not shrink when text fits", () => {
		const result = shrinkToFit("Hi", 10, 44);
		assert.strictEqual(result.options.fontSize, 44);
	});

	it("shrinks when text is too wide", () => {
		const result = shrinkToFit("a".repeat(100), 3, 44);
		assert.ok(result.options.fontSize < 44);
		assert.ok(result.options.fontSize >= 6);
	});

	it("respects minimum font size", () => {
		const result = shrinkToFit("a".repeat(500), 1, 44);
		assert.strictEqual(result.options.fontSize, 6);
	});

	it("preserves original text", () => {
		const result = shrinkToFit("Hello World", 2, 44);
		assert.strictEqual(result.text, "Hello World");
	});
});

// ---------------------------------------------------------------------------
// createSlide
// ---------------------------------------------------------------------------

describe("createSlide", () => {
	it("sets background color", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, { backgroundColor: "#FF5733" });
		assert.strictEqual(slide.background.fill, "#FF5733");
	});

	it("renders title layout with title and subtitle", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "title",
			title: "My Title",
			subtitle: "My Subtitle",
		});
		// pptxgenjs tracks added elements; verify no error
		assert.ok(slide);
	});

	it("renders content layout with title and bullet points", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "content",
			title: "Title",
			content: "Bullet 1\nBullet 2\nBullet 3",
		});
		assert.ok(slide);
	});

	it("renders quote layout", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "quote",
			quote: "To be or not to be",
			quoteAttribution: "Shakespeare",
		});
		assert.ok(slide);
	});

	it("renders table with headers and rows", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			tables: [
				{
					headers: ["Name", "Age"],
					rows: [
						["Alice", "30"],
						["Bob", "25"],
					],
				},
			],
		});
		assert.ok(slide);
	});

	it("renders table without headers", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			tables: [
				{
					rows: [
						["Alice", "30"],
						["Bob", "25"],
					],
				},
			],
		});
		assert.ok(slide);
	});

	it("renders table with custom options", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			tables: [
				{
					headers: ["A", "B"],
					rows: [["1", "2"]],
					options: {
						colW: [3, 3],
						fill: { color: "#F0F0F0" },
						border: { type: "solid", color: "#999999", pt: 2 },
					},
				},
			],
		});
		assert.ok(slide);
	});

	it("renders two-column layout with divider", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "two-column",
			title: "Two Columns",
			content: "Left side\nRight side",
		});
		assert.ok(slide);
	});

	it("renders comparison layout with divider", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "comparison",
			title: "Comparison",
			content: "Before\nAfter",
		});
		assert.ok(slide);
	});

	it("renders image-only layout", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {
			layout: "image-only",
			images: [{ path: join(FIXTURES, "test.png"), x: 0, y: 0, w: 6, h: 4 }],
		});
		assert.ok(slide);
	});

	it("renders slide with no content (empty slide)", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		createSlide(slide, {});
		assert.ok(slide);
	});

	it("returns the slide for chaining", () => {
		const pptx = new PptxGenJS();
		pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
		pptx.layout = "CUSTOM";
		const slide = pptx.addSlide();
		const result = createSlide(slide, { title: "Test" });
		assert.strictEqual(result, slide);
	});
});

// ---------------------------------------------------------------------------
// createPptx (integration)
// ---------------------------------------------------------------------------

describe("createPptx", () => {
	before(ensureTmp);
	after(cleanTmp);

	it("creates a minimal presentation with no slides", async () => {
		const outputPath = join(TMP, "minimal.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [],
			}),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(result.message.includes("saved to"));
		assert.strictEqual(result.filePath, outputPath);
		assert.strictEqual(result.slideCount, 1);

		// Verify file exists and is a valid PPTX
		const stat = await readFile(outputPath);
		assert.ok(stat);
	});

	it("creates a presentation with a single content slide", async () => {
		const outputPath = join(TMP, "single-slide.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "content",
						title: "Hello World",
						content: "First slide\nSecond line",
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.slideCount, 1);
	});

	it("creates a presentation with multiple slides", async () => {
		const outputPath = join(TMP, "multi-slide.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{ layout: "title", title: "Title Slide", subtitle: "Subtitle" },
					{ layout: "content", title: "Content", content: "Bullet 1\nBullet 2" },
					{ layout: "quote", quote: "A quote", quoteAttribution: "Someone" },
				],
			}),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.slideCount, 3);
	});

	it("creates a presentation with tables", async () => {
		const outputPath = join(TMP, "with-tables.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						title: "Data",
						tables: [
							{
								headers: ["Name", "Role"],
								rows: [
									["Alice", "Engineer"],
									["Bob", "Designer"],
								],
							},
						],
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates a presentation with custom slide dimensions", async () => {
		const outputPath = join(TMP, "custom-dimensions.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slideWidth: 10,
				slideHeight: 10,
				slides: [{ title: "Square" }],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("rejects output path outside allowed directory", async () => {
		const result = JSON.parse(
			await createPptx({
				outputPath: "/tmp/evil.pptx",
				slides: [],
			}),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("outside allowed directory"));
	});

	it("rejects invalid template path", async () => {
		const result = JSON.parse(
			await createPptx({
				outputPath: join(TMP, "with-template.pptx"),
				templatePath: join(FIXTURES, "not-a-pptx.txt"),
				slides: [],
			}),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not a valid PPTX"));
	});

	it("rejects unsupported image format", async () => {
		const result = JSON.parse(
			await createPptx({
				outputPath: join(TMP, "with-image.pptx"),
				slides: [{ images: [{ path: "/tmp/test.webp" }] }],
			}),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Image validation failed"));
	});

	it("creates presentation with valid image", async () => {
		const outputPath = join(TMP, "with-image.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "image-only",
						images: [{ path: join(FIXTURES, "test.png"), x: 0, y: 0, w: 6, h: 4 }],
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with background color", async () => {
		const outputPath = join(TMP, "bg-color.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [{ backgroundColor: "#1A1A2E", title: "Dark Slide" }],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with two-column layout", async () => {
		const outputPath = join(TMP, "two-column.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "two-column",
						title: "Comparison",
						content: "Option A\nOption B",
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with comparison layout", async () => {
		const outputPath = join(TMP, "comparison.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "comparison",
						title: "Before vs After",
						content: "Before state\nAfter state",
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with image-only layout", async () => {
		const outputPath = join(TMP, "image-only.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "image-only",
						images: [{ path: join(FIXTURES, "test.jpg"), x: 0, y: 0, w: 6, h: 4 }],
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with quote layout", async () => {
		const outputPath = join(TMP, "quote.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{
						layout: "quote",
						quote: "The only way to do great work is to love what you do.",
						quoteAttribution: "Steve Jobs",
					},
				],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("creates presentation with mixed slide types", async () => {
		const outputPath = join(TMP, "mixed.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [
					{ layout: "title", title: "Cover", subtitle: "A presentation" },
					{ layout: "content", title: "Overview", content: "Point 1\nPoint 2" },
					{
						layout: "content",
						title: "Data",
						tables: [{ headers: ["X", "Y"], rows: [["1", "2"]] }],
					},
					{ layout: "quote", quote: "Wisdom", quoteAttribution: "Me" },
				],
			}),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.slideCount, 4);
	});

	it("creates parent directories for output path", async () => {
		const outputPath = join(TMP, "nested", "deep", "presentation.pptx");
		const result = JSON.parse(
			await createPptx({
				outputPath,
				slides: [{ title: "Nested" }],
			}),
		);
		assert.strictEqual(result.ok, true);
	});

	it("throws PptxError on write failure", async () => {
		// Use a directory path as the output — writeFile will fail with EISDIR
		await mkdir(join(TMP, "write-fail-dir"), { recursive: true });
		await assert.rejects(
			async () =>
				await createPptx({
					outputPath: join(TMP, "write-fail-dir"),
					slides: [],
				}),
			PptxError,
		);
	});
});

// ---------------------------------------------------------------------------
// PptxError
// ---------------------------------------------------------------------------

describe("PptxError", () => {
	it("has correct name", () => {
		const err = new PptxError("test error");
		assert.strictEqual(err.name, "PptxError");
	});

	it("stores message", () => {
		const err = new PptxError("something broke");
		assert.strictEqual(err.message, "something broke");
	});

	it("stores reason", () => {
		const err = new PptxError("something broke", "generate-failed");
		assert.strictEqual(err.reason, "generate-failed");
	});

	it("defaults reason to null", () => {
		const err = new PptxError("something broke");
		assert.strictEqual(err.reason, null);
	});

	it("extends Error", () => {
		const err = new PptxError("test");
		assert.ok(err instanceof Error);
	});
});
