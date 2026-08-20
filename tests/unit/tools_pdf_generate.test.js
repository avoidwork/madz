import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
	generatePdfFromHtml,
	generatePdfFromMarkdown,
	mergePdfs,
	splitPdf,
	addWatermark,
	embedSignature,
	addAnnotations,
} from "../../src/tools/pdfGenerate.js";

const TEST_DIR = "memory/__test_pdf_generate__/";

/**
 * Create a minimal valid PDF buffer for testing.
 * @param {number} [pageCount=1] - Number of pages
 * @returns {Promise<Buffer>}
 */
async function createTestPdf(pageCount = 1) {
	const pdf = await PDFDocument.create();
	for (let i = 0; i < pageCount; i++) {
		const page = pdf.addPage();
		const font = await pdf.embedFont(StandardFonts.Helvetica);
		page.drawText(`Page ${i + 1}`, { x: 50, y: 750, font, fontSize: 14 });
	}
	return pdf.save();
}

/**
 * Create a test image buffer (minimal 1x1 PNG).
 * @returns {Buffer}
 */
function createTestImage() {
	// Minimal 1x1 red PNG
	return Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
		"base64",
	);
}

describe("pdfGenerate", () => {
	before(async () => {
		await mkdir(TEST_DIR, { recursive: true });
	});

	after(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	describe("generatePdfFromHtml", () => {
		it("requires html string", async () => {
			const result = JSON.parse(
				await generatePdfFromHtml({ filePath: join(TEST_DIR, "test.html") }),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("HTML string is required"));
		});

		it("requires filePath", async () => {
			const result = JSON.parse(await generatePdfFromHtml({ html: "<p>test</p>" }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath is required"));
		});

		it("generates a valid PDF from HTML", async () => {
			const outputPath = join(TEST_DIR, "html_output.pdf");
			const result = JSON.parse(
				await generatePdfFromHtml({
					html: "<html><body><h1>Hello World</h1></body></html>",
					filePath: outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.filePath, outputPath);

			// Verify the PDF is valid
			const buffer = await readFile(outputPath);
			const pdf = await PDFDocument.load(buffer);
			assert.ok(pdf);
			assert.strictEqual(pdf.getPageCount(), 1);
		});

		it("generates PDF with custom page options", async () => {
			const outputPath = join(TEST_DIR, "html_options.pdf");
			const result = JSON.parse(
				await generatePdfFromHtml({
					html: "<html><body><p>Test content</p></body></html>",
					filePath: outputPath,
					options: {
						format: "letter",
						orientation: "landscape",
					},
				}),
			);
			assert.strictEqual(result.ok, true);

			const buffer = await readFile(outputPath);
			const pdf = await PDFDocument.load(buffer);
			assert.ok(pdf);
		});
	});

	describe("generatePdfFromMarkdown", () => {
		it("requires markdown string", async () => {
			const result = JSON.parse(
				await generatePdfFromMarkdown({ filePath: join(TEST_DIR, "test.md") }),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Markdown string is required"));
		});

		it("requires filePath", async () => {
			const result = JSON.parse(await generatePdfFromMarkdown({ markdown: "# Test" }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath is required"));
		});

		it("generates a valid PDF from markdown", async () => {
			const outputPath = join(TEST_DIR, "md_output.pdf");
			const result = JSON.parse(
				await generatePdfFromMarkdown({
					markdown: "# Hello World\n\nThis is a test.",
					filePath: outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.filePath, outputPath);

			const buffer = await readFile(outputPath);
			const pdf = await PDFDocument.load(buffer);
			assert.ok(pdf);
			assert.strictEqual(pdf.getPageCount(), 1);
		});

		it("generates PDF with custom CSS", async () => {
			const outputPath = join(TEST_DIR, "md_css.pdf");
			const result = JSON.parse(
				await generatePdfFromMarkdown({
					markdown: "# Styled\n\nContent here.",
					filePath: outputPath,
					css: "body { color: red; }",
				}),
			);
			assert.strictEqual(result.ok, true);

			const buffer = await readFile(outputPath);
			const pdf = await PDFDocument.load(buffer);
			assert.ok(pdf);
		});
	});

	describe("mergePdfs", () => {
		it("requires at least 2 file paths", async () => {
			const result = JSON.parse(
				await mergePdfs({
					filePaths: ["only_one.pdf"],
					outputPath: join(TEST_DIR, "merged.pdf"),
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("At least 2 PDF file paths"));
		});

		it("requires outputPath or base64", async () => {
			const pdf1 = await createTestPdf();
			const pdf2 = await createTestPdf();
			await writeFile(join(TEST_DIR, "a.pdf"), pdf1);
			await writeFile(join(TEST_DIR, "b.pdf"), pdf2);

			const result = JSON.parse(
				await mergePdfs({
					filePaths: [join(TEST_DIR, "a.pdf"), join(TEST_DIR, "b.pdf")],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("outputPath or base64"));
		});

		it("merges two PDFs", async () => {
			const pdf1 = await createTestPdf(1);
			const pdf2 = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "a.pdf"), pdf1);
			await writeFile(join(TEST_DIR, "b.pdf"), pdf2);

			const outputPath = join(TEST_DIR, "merged.pdf");
			const result = JSON.parse(
				await mergePdfs({
					filePaths: [join(TEST_DIR, "a.pdf"), join(TEST_DIR, "b.pdf")],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const merged = await PDFDocument.load(await readFile(outputPath));
			assert.strictEqual(merged.getPageCount(), 3); // 1 + 2
		});

		it("merges PDFs and returns base64", async () => {
			const pdf1 = await createTestPdf(1);
			const pdf2 = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "c.pdf"), pdf1);
			await writeFile(join(TEST_DIR, "d.pdf"), pdf2);

			const result = JSON.parse(
				await mergePdfs({
					filePaths: [join(TEST_DIR, "c.pdf"), join(TEST_DIR, "d.pdf")],
					outputPath: join(TEST_DIR, "merged2.pdf"),
					base64: true,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(result.base64);

			// Verify the base64 decodes to a valid PDF
			const buffer = Buffer.from(result.base64, "base64");
			const merged = await PDFDocument.load(buffer);
			assert.strictEqual(merged.getPageCount(), 3);
		});

		it("rejects file exceeding max size", async () => {
			// Create a large fake PDF buffer (larger than 50MB)
			const largeBuffer = Buffer.alloc(51 * 1024 * 1024, 0x00);
			await writeFile(join(TEST_DIR, "large.pdf"), largeBuffer);

			const pdf2 = await createTestPdf(1);
			await writeFile(join(TEST_DIR, "small.pdf"), pdf2);

			const result = JSON.parse(
				await mergePdfs({
					filePaths: [join(TEST_DIR, "large.pdf"), join(TEST_DIR, "small.pdf")],
					outputPath: join(TEST_DIR, "merged_large.pdf"),
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("exceeds maximum"));
		});
	});

	describe("splitPdf", () => {
		it("requires filePath", async () => {
			const result = JSON.parse(await splitPdf({ pageRange: "1" }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath is required"));
		});

		it("requires pageRange", async () => {
			const result = JSON.parse(await splitPdf({ filePath: join(TEST_DIR, "test.pdf") }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Page range is required"));
		});

		it("requires outputPattern or base64", async () => {
			const pdf = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "split_src.pdf"), pdf);

			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "split_src.pdf"),
					pageRange: "1",
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("outputPattern or base64"));
		});

		it("splits PDF by page range", async () => {
			const pdf = await createTestPdf(3);
			await writeFile(join(TEST_DIR, "src_range.pdf"), pdf);

			const outputPath = join(TEST_DIR, "split_%d.pdf");
			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "src_range.pdf"),
					pageRange: "1-2",
					outputPattern: outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.files.length, 2);
		});

		it("splits PDF by individual pages", async () => {
			const pdf = await createTestPdf(3);
			await writeFile(join(TEST_DIR, "src_pages.pdf"), pdf);

			const outputPath = join(TEST_DIR, "split_pages_%d.pdf");
			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "src_pages.pdf"),
					pageRange: "1,3",
					outputPattern: outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.files.length, 2);
		});

		it("splits PDF by all pages", async () => {
			const pdf = await createTestPdf(3);
			await writeFile(join(TEST_DIR, "src_all.pdf"), pdf);

			const outputPath = join(TEST_DIR, "split_all_%d.pdf");
			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "src_all.pdf"),
					pageRange: "all",
					outputPattern: outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.files.length, 3);
		});

		it("returns base64 array when requested", async () => {
			const pdf = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "src_b64.pdf"), pdf);

			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "src_b64.pdf"),
					pageRange: "1-2",
					base64: true,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.base64));
			assert.strictEqual(result.base64.length, 2);

			// Verify each base64 is a valid PDF
			for (const b64 of result.base64) {
				const buffer = Buffer.from(b64, "base64");
				const p = await PDFDocument.load(buffer);
				assert.strictEqual(p.getPageCount(), 1);
			}
		});

		it("rejects invalid page range", async () => {
			const pdf = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "src_invalid.pdf"), pdf);

			const result = JSON.parse(
				await splitPdf({
					filePath: join(TEST_DIR, "src_invalid.pdf"),
					pageRange: "1-5",
					outputPattern: join(TEST_DIR, "out_%d.pdf"),
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("out of range"));
		});
	});

	describe("addWatermark", () => {
		it("requires filePath or base64", async () => {
			const result = JSON.parse(await addWatermark({ text: "WATERMARK" }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath or base64"));
		});

		it("requires text or image watermark", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "wm_src.pdf"), pdf);

			const result = JSON.parse(
				await addWatermark({
					filePath: join(TEST_DIR, "wm_src.pdf"),
					outputPath: join(TEST_DIR, "wm_out.pdf"),
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("text or image watermark"));
		});

		it("adds text watermark to all pages", async () => {
			const pdf = await createTestPdf(2);
			await writeFile(join(TEST_DIR, "wm_all.pdf"), pdf);

			const outputPath = join(TEST_DIR, "wm_all_out.pdf");
			const result = JSON.parse(
				await addWatermark({
					filePath: join(TEST_DIR, "wm_all.pdf"),
					text: "CONFIDENTIAL",
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.strictEqual(outputPdf.getPageCount(), 2);
		});

		it("adds text watermark to specific pages", async () => {
			const pdf = await createTestPdf(3);
			await writeFile(join(TEST_DIR, "wm_pages.pdf"), pdf);

			const outputPath = join(TEST_DIR, "wm_pages_out.pdf");
			const result = JSON.parse(
				await addWatermark({
					filePath: join(TEST_DIR, "wm_pages.pdf"),
					text: "PAGE 2 ONLY",
					pages: [2],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.strictEqual(outputPdf.getPageCount(), 3);
		});

		it("adds image watermark", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "wm_img_src.pdf"), pdf);
			const image = createTestImage();

			const outputPath = join(TEST_DIR, "wm_img_out.pdf");
			const result = JSON.parse(
				await addWatermark({
					filePath: join(TEST_DIR, "wm_img_src.pdf"),
					imageBase64: image.toString("base64"),
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("returns base64 output", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "wm_b64_src.pdf"), pdf);

			const result = JSON.parse(
				await addWatermark({
					filePath: join(TEST_DIR, "wm_b64_src.pdf"),
					text: "WATERMARK",
					base64Output: true,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(result.base64);

			const outputPdf = await PDFDocument.load(Buffer.from(result.base64, "base64"));
			assert.ok(outputPdf);
		});

		it("accepts base64 input", async () => {
			const pdf = await createTestPdf();
			const base64Input = Buffer.from(pdf).toString("base64");

			const outputPath = join(TEST_DIR, "wm_b64in_out.pdf");
			const result = JSON.parse(
				await addWatermark({
					base64: base64Input,
					text: "FROM BASE64",
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});
	});

	describe("embedSignature", () => {
		it("requires filePath or base64", async () => {
			const result = JSON.parse(await embedSignature({ text: "Signed", page: 1, x: 50, y: 50 }));
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath or base64"));
		});

		it("requires text or image signature", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "sig_src.pdf"), pdf);

			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_src.pdf"),
					page: 1,
					x: 50,
					y: 50,
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("text or image signature"));
		});

		it("requires page, x, y", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "sig_coords.pdf"), pdf);

			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_coords.pdf"),
					text: "Signed",
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("page, x, and y"));
		});

		it("embeds text signature", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "sig_text_src.pdf"), pdf);

			const outputPath = join(TEST_DIR, "sig_text_out.pdf");
			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_text_src.pdf"),
					text: "John Doe",
					page: 1,
					x: 50,
					y: 700,
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("embeds image signature", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "sig_img_src.pdf"), pdf);
			const image = createTestImage();

			const outputPath = join(TEST_DIR, "sig_img_out.pdf");
			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_img_src.pdf"),
					imageBase64: image.toString("base64"),
					page: 1,
					x: 50,
					y: 700,
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("rejects out-of-range page", async () => {
			const pdf = await createTestPdf(1);
			await writeFile(join(TEST_DIR, "sig_page.pdf"), pdf);

			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_page.pdf"),
					text: "Signed",
					page: 5,
					x: 50,
					y: 50,
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("out of range"));
		});

		it("returns base64 output", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "sig_b64_src.pdf"), pdf);

			const result = JSON.parse(
				await embedSignature({
					filePath: join(TEST_DIR, "sig_b64_src.pdf"),
					text: "Signed",
					page: 1,
					x: 50,
					y: 50,
					base64Output: true,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(result.base64);

			const outputPdf = await PDFDocument.load(Buffer.from(result.base64, "base64"));
			assert.ok(outputPdf);
		});
	});

	describe("addAnnotations", () => {
		it("requires filePath or base64", async () => {
			const result = JSON.parse(
				await addAnnotations({
					annotations: [{ type: "note", page: 1, position: { x: 0, y: 0 } }],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("filePath or base64"));
		});

		it("requires at least one annotation", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_src.pdf"), pdf);

			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_src.pdf"),
					annotations: [],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("At least one annotation"));
		});

		it("requires annotation fields", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_fields.pdf"), pdf);

			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_fields.pdf"),
					annotations: [{ type: "note" }],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("type, page, and position"));
		});

		it("adds highlight annotation", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_highlight_src.pdf"), pdf);

			const outputPath = join(TEST_DIR, "ann_highlight_out.pdf");
			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_highlight_src.pdf"),
					annotations: [
						{
							type: "highlight",
							page: 1,
							position: { x: 50, y: 700, width: 100, height: 20 },
						},
					],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("adds note annotation", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_note_src.pdf"), pdf);

			const outputPath = join(TEST_DIR, "ann_note_out.pdf");
			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_note_src.pdf"),
					annotations: [
						{
							type: "note",
							page: 1,
							position: { x: 50, y: 700 },
							content: "This is a note",
						},
					],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("adds stamp annotation", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_stamp_src.pdf"), pdf);

			const outputPath = join(TEST_DIR, "ann_stamp_out.pdf");
			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_stamp_src.pdf"),
					annotations: [
						{
							type: "stamp",
							page: 1,
							position: { x: 50, y: 700 },
							content: "APPROVED",
						},
					],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("adds multiple annotations", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_multi_src.pdf"), pdf);

			const outputPath = join(TEST_DIR, "ann_multi_out.pdf");
			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_multi_src.pdf"),
					annotations: [
						{
							type: "highlight",
							page: 1,
							position: { x: 50, y: 700, width: 100, height: 20 },
						},
						{
							type: "note",
							page: 1,
							position: { x: 200, y: 700 },
							content: "Note here",
						},
						{
							type: "stamp",
							page: 1,
							position: { x: 50, y: 600 },
							content: "REVIEWED",
						},
					],
					outputPath,
				}),
			);
			assert.strictEqual(result.ok, true);

			const outputPdf = await PDFDocument.load(await readFile(outputPath));
			assert.ok(outputPdf);
		});

		it("rejects unknown annotation type", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_type_src.pdf"), pdf);

			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_type_src.pdf"),
					annotations: [
						{
							type: "invalid_type",
							page: 1,
							position: { x: 50, y: 50 },
						},
					],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Unknown annotation type"));
		});

		it("rejects out-of-range page", async () => {
			const pdf = await createTestPdf(1);
			await writeFile(join(TEST_DIR, "ann_page_src.pdf"), pdf);

			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_page_src.pdf"),
					annotations: [
						{
							type: "note",
							page: 5,
							position: { x: 50, y: 50 },
						},
					],
				}),
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("out of range"));
		});

		it("returns base64 output", async () => {
			const pdf = await createTestPdf();
			await writeFile(join(TEST_DIR, "ann_b64_src.pdf"), pdf);

			const result = JSON.parse(
				await addAnnotations({
					filePath: join(TEST_DIR, "ann_b64_src.pdf"),
					annotations: [
						{
							type: "highlight",
							page: 1,
							position: { x: 50, y: 700, width: 100, height: 20 },
						},
					],
					base64Output: true,
				}),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(result.base64);

			const outputPdf = await PDFDocument.load(Buffer.from(result.base64, "base64"));
			assert.ok(outputPdf);
		});
	});
});
