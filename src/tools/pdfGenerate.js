/**
 * PDF generation and manipulation tools.
 * Uses puppeteer for HTML/markdown-to-PDF generation and pdf-lib for manipulation.
 * @module tools/pdfGenerate
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, writeFile, stat } from "node:fs/promises";
import { marked } from "marked";
import puppeteer from "puppeteer";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

// --- Constants ---

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_WATERMARK_OPACITY = 0.3;
const DEFAULT_WATERMARK_ROTATION = -45;

// --- Helpers ---

/**
 * Check if a file exceeds the maximum size limit.
 * @param {string} filePath - Path to the file
 * @param {number} maxSizeBytes - Maximum allowed size in bytes
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function checkFileSize(filePath, maxSizeBytes) {
	try {
		const stats = await stat(filePath);
		if (stats.size > maxSizeBytes) {
			return {
				ok: false,
				error: `File size (${stats.size} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes)`,
			};
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: `Failed to stat file: ${err.message}` };
	}
}

/**
 * Load a PDF from a file path or base64 string.
 * @param {object} input - Input object with either filePath or base64
 * @param {string} [input.filePath] - Path to the PDF file
 * @param {string} [input.base64] - Base64-encoded PDF content
 * @returns {Promise<{ ok: boolean, pdf?: PDFDocument, error?: string }>}
 */
async function loadPdf(input) {
	if (input.filePath) {
		const sizeCheck = await checkFileSize(input.filePath, DEFAULT_MAX_FILE_SIZE);
		if (!sizeCheck.ok) return { ok: false, error: sizeCheck.error };
		try {
			const buffer = await readFile(input.filePath);
			const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
			return { ok: true, pdf };
		} catch (err) {
			return { ok: false, error: `Failed to load PDF: ${err.message}` };
		}
	}
	if (input.base64) {
		try {
			const buffer = Buffer.from(input.base64, "base64");
			if (buffer.length > DEFAULT_MAX_FILE_SIZE) {
				return {
					ok: false,
					error: `Buffer size (${buffer.length} bytes) exceeds maximum allowed size (${DEFAULT_MAX_FILE_SIZE} bytes)`,
				};
			}
			const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
			return { ok: true, pdf };
		} catch (err) {
			return { ok: false, error: `Failed to decode base64 PDF: ${err.message}` };
		}
	}
	return { ok: false, error: "Either filePath or base64 must be provided" };
}

/**
 * Save a PDF document to a file path or return as base64.
 * @param {PDFDocument} pdf - The PDF document
 * @param {object} output - Output configuration
 * @param {string} [output.filePath] - Path to write the PDF
 * @param {boolean} [output.base64] - Return as base64 instead of writing to file
 * @returns {Promise<{ ok: boolean, filePath?: string, base64?: string, error?: string }>}
 */
async function savePdf(pdf, output) {
	const bytes = await pdf.save();
	if (output.base64) {
		return { ok: true, base64: Buffer.from(bytes).toString("base64") };
	}
	if (output.filePath) {
		await writeFile(output.filePath, bytes);
		return { ok: true, filePath: output.filePath };
	}
	return { ok: false, error: "Either filePath or base64 output must be specified" };
}

/**
 * Parse a page range string like "1-3" or "1,3,5" into zero-indexed page numbers.
 * @param {string} rangeStr - Range string
 * @param {number} totalPages - Total number of pages in the source PDF
 * @returns {{ ok: boolean, pages?: number[], error?: string }}
 */
function parsePageRange(rangeStr, totalPages) {
	const pages = new Set();
	const parts = rangeStr.split(",").map((p) => p.trim());
	for (const part of parts) {
		if (part.includes("-")) {
			const [start, end] = part.split("-").map(Number);
			if (isNaN(start) || isNaN(end)) {
				return { ok: false, error: `Invalid page range: ${part}` };
			}
			for (let i = start; i <= end; i++) {
				if (i < 1 || i > totalPages) {
					return { ok: false, error: `Page ${i} is out of range (1-${totalPages})` };
				}
				pages.add(i - 1);
			}
		} else {
			const pageNum = parseInt(part, 10);
			if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
				return { ok: false, error: `Invalid page number: ${part}` };
			}
			pages.add(pageNum - 1);
		}
	}
	return { ok: true, pages: Array.from(pages).sort() };
}

/**
 * Load an image (PNG/JPG) from a file path or base64 string.
 * @param {object} input - Input with filePath or base64
 * @param {string} [input.filePath] - Path to the image file
 * @param {string} [input.base64] - Base64-encoded image content
 * @returns {Promise<{ ok: boolean, image?: import("pdf-lib").PdfImage, error?: string }>}
 */
async function loadImage(input) {
	if (input.filePath) {
		try {
			const buffer = await readFile(input.filePath);
			if (buffer.length > DEFAULT_MAX_FILE_SIZE) {
				return { ok: false, error: "Image file exceeds maximum size" };
			}
			try {
				const image = await PDFDocument.create().then((doc) => doc.embedPng(buffer));
				return { ok: true, image };
			} catch {
				const image = await PDFDocument.create().then((doc) => doc.embedJpg(buffer));
				return { ok: true, image };
			}
		} catch (err) {
			return { ok: false, error: `Failed to load image: ${err.message}` };
		}
	}
	if (input.base64) {
		try {
			const buffer = Buffer.from(input.base64, "base64");
			try {
				const image = await PDFDocument.create().then((doc) => doc.embedPng(buffer));
				return { ok: true, image };
			} catch {
				const image = await PDFDocument.create().then((doc) => doc.embedJpg(buffer));
				return { ok: true, image };
			}
		} catch (err) {
			return { ok: false, error: `Failed to decode base64 image: ${err.message}` };
		}
	}
	return { ok: false, error: "Either filePath or base64 must be provided for image" };
}

/**
 * Convert a hex color string to RGB.
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {import("pdf-lib").RGB}
 */
function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? rgb(
				parseInt(result[1], 16) / 255,
				parseInt(result[2], 16) / 255,
				parseInt(result[3], 16) / 255,
			)
		: rgb(0, 0, 0);
}

// --- Tool Implementations ---

/**
 * Generate a PDF from an HTML string using puppeteer.
 * @param {object} input - Tool input
 * @param {string} input.html - HTML string to convert
 * @param {string} input.filePath - Output file path
 * @param {object} [input.options] - Page options
 * @param {string} [input.options.format] - Paper format (a4, letter, etc.)
 * @param {object} [input.options.margin] - Page margins
 * @param {string} [input.options.orientation] - "portrait" or "landscape"
 * @param {object} [input.options.headerTemplate] - HTML template for header
 * @param {object} [input.options.footerTemplate] - HTML template for footer
 * @returns {Promise<string>} JSON result string
 */
export async function generatePdfFromHtml(input) {
	const { html, filePath, options } = input;

	if (!html || typeof html !== "string") {
		return JSON.stringify({ ok: false, error: "HTML string is required" });
	}
	if (!filePath || typeof filePath !== "string") {
		return JSON.stringify({ ok: false, error: "Output filePath is required" });
	}

	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });

		const pdfOptions = {
			printBackground: true,
			...options,
		};

		await page.pdf({
			...pdfOptions,
			path: filePath,
		});

		return JSON.stringify({ ok: true, filePath });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `PDF generation failed: ${err.message}` });
	} finally {
		await browser.close();
	}
}

/**
 * Generate a PDF from a markdown string using puppeteer.
 * @param {object} input - Tool input
 * @param {string} input.markdown - Markdown string to convert
 * @param {string} input.filePath - Output file path
 * @param {string} [input.css] - Optional custom CSS styles
 * @param {object} [input.options] - Page options (format, margin, orientation)
 * @returns {Promise<string>} JSON result string
 */
export async function generatePdfFromMarkdown(input) {
	const { markdown, filePath, css, options } = input;

	if (!markdown || typeof markdown !== "string") {
		return JSON.stringify({ ok: false, error: "Markdown string is required" });
	}
	if (!filePath || typeof filePath !== "string") {
		return JSON.stringify({ ok: false, error: "Output filePath is required" });
	}

	const html = marked.parse(markdown);
	const wrapper = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<style>
				body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
				pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
				code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
				table { border-collapse: collapse; width: 100%; }
				th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
				th { background: #f5f5f5; }
				blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; }
				${css || ""}
			</style>
		</head>
		<body>
			${html}
		</body>
		</html>
	`;

	return generatePdfFromHtml({ html: wrapper, filePath, options });
}

/**
 * Merge multiple PDF files into a single PDF.
 * @param {object} input - Tool input
 * @param {string[]} input.filePaths - Array of PDF file paths to merge
 * @param {string} input.outputPath - Output file path
 * @param {boolean} [input.base64] - Return result as base64 instead of writing to file
 * @returns {Promise<string>} JSON result string
 */
export async function mergePdfs(input) {
	const { filePaths, outputPath, base64 } = input;

	if (!filePaths || !Array.isArray(filePaths) || filePaths.length < 2) {
		return JSON.stringify({ ok: false, error: "At least 2 PDF file paths are required" });
	}
	if (!outputPath && !base64) {
		return JSON.stringify({ ok: false, error: "Either outputPath or base64 output is required" });
	}

	const mergedPdf = await PDFDocument.create();

	for (const filePath of filePaths) {
		const sizeCheck = await checkFileSize(filePath, DEFAULT_MAX_FILE_SIZE);
		if (!sizeCheck.ok) {
			return JSON.stringify({ ok: false, error: sizeCheck.error });
		}
		try {
			const buffer = await readFile(filePath);
			const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
			const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
			pages.forEach((page) => mergedPdf.addPage(page));
		} catch (err) {
			return JSON.stringify({ ok: false, error: `Failed to merge ${filePath}: ${err.message}` });
		}
	}

	const result = await savePdf(mergedPdf, { filePath: outputPath, base64 });
	return JSON.stringify(result);
}

/**
 * Split a PDF into multiple PDFs by page range or individual pages.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Source PDF file path
 * @param {string} input.pageRange - Page range (e.g., "1-3" or "1,3,5") or "all" for individual pages
 * @param {string} input.outputPattern - Output path pattern (e.g., "output_%d.pdf")
 * @param {boolean} [input.base64] - Return results as base64 array
 * @returns {Promise<string>} JSON result string
 */
export async function splitPdf(input) {
	const { filePath, pageRange, outputPattern, base64 } = input;

	if (!filePath || typeof filePath !== "string") {
		return JSON.stringify({ ok: false, error: "Source filePath is required" });
	}
	if (!pageRange || typeof pageRange !== "string") {
		return JSON.stringify({ ok: false, error: "Page range is required" });
	}
	if (!outputPattern && !base64) {
		return JSON.stringify({
			ok: false,
			error: "Either outputPattern or base64 output is required",
		});
	}

	const sizeCheck = await checkFileSize(filePath, DEFAULT_MAX_FILE_SIZE);
	if (!sizeCheck.ok) {
		return JSON.stringify({ ok: false, error: sizeCheck.error });
	}

	const buffer = await readFile(filePath);
	const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
	const totalPages = srcPdf.getPageCount();

	let pagesToExtract;
	if (pageRange === "all") {
		pagesToExtract = Array.from({ length: totalPages }, (_, i) => i);
	} else {
		const parsed = parsePageRange(pageRange, totalPages);
		if (!parsed.ok) {
			return JSON.stringify({ ok: false, error: parsed.error });
		}
		pagesToExtract = parsed.pages;
	}

	if (base64) {
		const results = [];
		for (const pageNum of pagesToExtract) {
			const newPdf = await PDFDocument.create();
			const [page] = await newPdf.copyPages(srcPdf, [pageNum]);
			newPdf.addPage(page);
			const bytes = await newPdf.save();
			results.push(Buffer.from(bytes).toString("base64"));
		}
		return JSON.stringify({ ok: true, base64: results });
	}

	// Write individual files
	const createdFiles = [];
	for (const pageNum of pagesToExtract) {
		const newPdf = await PDFDocument.create();
		const [page] = await newPdf.copyPages(srcPdf, [pageNum]);
		newPdf.addPage(page);
		const outFile = outputPattern.replace("%d", String(pageNum + 1));
		await writeFile(outFile, await newPdf.save());
		createdFiles.push(outFile);
	}

	return JSON.stringify({ ok: true, files: createdFiles });
}

/**
 * Add a text or image watermark to a PDF.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Source PDF file path
 * @param {string} [input.base64] - Source PDF as base64
 * @param {string} [input.text] - Watermark text
 * @param {string} [input.imagePath] - Path to watermark image
 * @param {string} [input.imageBase64] - Base64 watermark image
 * @param {number} [input.opacity=0.3] - Watermark opacity (0-1)
 * @param {number} [input.rotation=-45] - Watermark rotation in degrees
 * @param {string} [input.position="center"] - Watermark position (center, top-left, top-right, bottom-left, bottom-right)
 * @param {number[]} [input.pages] - Specific pages to watermark (1-indexed), or omit for all pages
 * @param {string} [input.outputPath] - Output file path
 * @param {boolean} [input.base64Output] - Return result as base64
 * @returns {Promise<string>} JSON result string
 */
export async function addWatermark(input) {
	const {
		filePath,
		base64,
		text,
		imagePath,
		imageBase64,
		opacity = DEFAULT_WATERMARK_OPACITY,
		rotation = DEFAULT_WATERMARK_ROTATION,
		position = "center",
		pages,
		outputPath,
		base64Output,
	} = input;

	if (!filePath && !base64) {
		return JSON.stringify({ ok: false, error: "Either filePath or base64 is required" });
	}
	if (!text && !imagePath && !imageBase64) {
		return JSON.stringify({ ok: false, error: "Either text or image watermark must be provided" });
	}

	const loadResult = await loadPdf({ filePath, base64 });
	if (!loadResult.ok) {
		return JSON.stringify({ ok: false, error: loadResult.error });
	}

	const pdf = loadResult.pdf;
	const pagesToWatermark = pages
		? pages.map((p) => p - 1)
		: Array.from({ length: pdf.getPageCount() }, (_, i) => i);

	if (text) {
		const font = await pdf.embedFont(StandardFonts.Helvetica);
		const fontSize = 40;

		for (const pageNum of pagesToWatermark) {
			const page = pdf.getPage(pageNum);
			const { width, height } = page.getSize();

			let x, y;
			switch (position) {
				case "top-left":
					x = 50;
					y = height - 50;
					break;
				case "top-right":
					x = width - 50;
					y = height - 50;
					break;
				case "bottom-left":
					x = 50;
					y = 50;
					break;
				case "bottom-right":
					x = width - 50;
					y = 50;
					break;
				default: // center
					x = width / 2;
					y = height / 2;
			}

			page.drawText(text, {
				x,
				y,
				size: fontSize,
				font,
				color: rgb(0.5, 0.5, 0.5),
				opacity,
				rotate: degrees(rotation),
			});
		}
	}

	if (imagePath || imageBase64) {
		const imageResult = await loadImage({ filePath: imagePath, base64: imageBase64 });
		if (!imageResult.ok) {
			return JSON.stringify({ ok: false, error: imageResult.error });
		}

		for (const pageNum of pagesToWatermark) {
			const page = pdf.getPage(pageNum);
			const { width, height } = page.getSize();

			const imgWidth = width * 0.3;
			const imgHeight = (imageResult.image.height / imageResult.image.width) * imgWidth;

			page.drawImage(imageResult.image, {
				x: width / 2 - imgWidth / 2,
				y: height / 2 - imgHeight / 2,
				width: imgWidth,
				height: imgHeight,
				opacity,
				rotate: degrees(rotation),
			});
		}
	}

	const result = await savePdf(pdf, { filePath: outputPath, base64: base64Output });
	return JSON.stringify(result);
}

/**
 * Embed a signature (image or text) into a PDF.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Source PDF file path
 * @param {string} [input.base64] - Source PDF as base64
 * @param {string} [input.text] - Text signature
 * @param {string} [input.imagePath] - Path to signature image
 * @param {string} [input.imageBase64] - Base64 signature image
 * @param {number} input.page - Page number (1-indexed)
 * @param {number} input.x - X position
 * @param {number} input.y - Y position
 * @param {number} [input.width=150] - Signature width
 * @param {number} [input.height=50] - Signature height
 * @param {object} [input.fontOptions] - Font options for text signature
 * @param {string} [input.fontOptions.name] - Font name (Helvetica, TimesRoman, Courier, etc.)
 * @param {number} [input.fontOptions.size=14] - Font size
 * @param {string} [input.fontOptions.color] - Font color (hex string)
 * @param {string} [input.outputPath] - Output file path
 * @param {boolean} [input.base64Output] - Return result as base64
 * @returns {Promise<string>} JSON result string
 */
export async function embedSignature(input) {
	const {
		filePath,
		base64,
		text,
		imagePath,
		imageBase64,
		page,
		x,
		y,
		width = 150,
		height = 50,
		fontOptions,
		outputPath,
		base64Output,
	} = input;

	if (!filePath && !base64) {
		return JSON.stringify({ ok: false, error: "Either filePath or base64 is required" });
	}
	if (!text && !imagePath && !imageBase64) {
		return JSON.stringify({ ok: false, error: "Either text or image signature must be provided" });
	}
	if (!page || !x || !y) {
		return JSON.stringify({
			ok: false,
			error: "page, x, and y coordinates are required",
		});
	}

	const loadResult = await loadPdf({ filePath, base64 });
	if (!loadResult.ok) {
		return JSON.stringify({ ok: false, error: loadResult.error });
	}

	const pdf = loadResult.pdf;
	const pageNum = page - 1;

	if (pageNum < 0 || pageNum >= pdf.getPageCount()) {
		return JSON.stringify({
			ok: false,
			error: `Page ${page} is out of range (1-${pdf.getPageCount()})`,
		});
	}

	const pdfPage = pdf.getPage(pageNum);

	if (text) {
		const fontName = fontOptions?.name || "Helvetica";
		const fontSize = fontOptions?.size || 14;
		const font = await pdf.embedFont(StandardFonts[fontName]);

		pdfPage.drawText(text, {
			x,
			y,
			size: fontSize,
			font,
			color: fontOptions?.color ? hexToRgb(fontOptions.color) : rgb(0, 0, 0),
		});
	}

	if (imagePath || imageBase64) {
		const imageResult = await loadImage({ filePath: imagePath, base64: imageBase64 });
		if (!imageResult.ok) {
			return JSON.stringify({ ok: false, error: imageResult.error });
		}

		pdfPage.drawImage(imageResult.image, {
			x,
			y,
			width,
			height,
		});
	}

	const result = await savePdf(pdf, { filePath: outputPath, base64: base64Output });
	return JSON.stringify(result);
}

/**
 * Add annotations (highlights, notes, stamps) to a PDF.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Source PDF file path
 * @param {string} [input.base64] - Source PDF as base64
 * @param {Array<object>} input.annotations - Array of annotation definitions
 * @param {string} input.annotations[].type - Annotation type: "note", "highlight", "stamp"
 * @param {number} input.annotations[].page - Page number (1-indexed)
 * @param {object} input.annotations[].position - Position coordinates
 * @param {number} input.annotations[].position.x - X position
 * @param {number} input.annotations[].position.y - Y position
 * @param {number} [input.annotations[].position.width] - Width (for highlights)
 * @param {number} [input.annotations[].position.height] - Height (for highlights)
 * @param {string} [input.annotations[].content] - Annotation content (note text, stamp text)
 * @param {string} [input.annotations[].color] - Color (hex string, default: "#FFFF00" for highlights, "#FFFFFF" for notes)
 * @param {string} [input.outputPath] - Output file path
 * @param {boolean} [input.base64Output] - Return result as base64
 * @returns {Promise<string>} JSON result string
 */
export async function addAnnotations(input) {
	const { filePath, base64, annotations, outputPath, base64Output } = input;

	if (!filePath && !base64) {
		return JSON.stringify({ ok: false, error: "Either filePath or base64 is required" });
	}
	if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
		return JSON.stringify({ ok: false, error: "At least one annotation is required" });
	}

	const loadResult = await loadPdf({ filePath, base64 });
	if (!loadResult.ok) {
		return JSON.stringify({ ok: false, error: loadResult.error });
	}

	const pdf = loadResult.pdf;

	for (const annotation of annotations) {
		const { type, page, position, content, color } = annotation;

		if (!type || !page || !position || !position.x || !position.y) {
			return JSON.stringify({
				ok: false,
				error: "Each annotation requires type, page, and position (x, y)",
			});
		}

		const pageNum = page - 1;
		if (pageNum < 0 || pageNum >= pdf.getPageCount()) {
			return JSON.stringify({
				ok: false,
				error: `Page ${page} is out of range (1-${pdf.getPageCount()})`,
			});
		}

		const pdfPage = pdf.getPage(pageNum);
		const annotationColor = color ? hexToRgb(color) : rgb(1, 1, 0);

		switch (type) {
			case "note": {
				pdfPage.drawRectangle({
					x: position.x,
					y: position.y,
					width: 20,
					height: 20,
					color: rgb(1, 1, 0),
					borderWidth: 1,
					borderColor: rgb(0.8, 0.8, 0),
				});
				break;
			}
			case "highlight": {
				const highlightWidth = position.width || 100;
				const highlightHeight = position.height || 20;
				pdfPage.drawRectangle({
					x: position.x,
					y: position.y,
					width: highlightWidth,
					height: highlightHeight,
					color: annotationColor,
					opacity: 0.4,
				});
				break;
			}
			case "stamp": {
				const font = await pdf.embedFont(StandardFonts.HelveticaBold);
				pdfPage.drawText(content || "STAMP", {
					x: position.x,
					y: position.y,
					size: 24,
					font,
					color: annotationColor,
				});
				break;
			}
			default:
				return JSON.stringify({
					ok: false,
					error: `Unknown annotation type: ${type}. Use "note", "highlight", or "stamp"`,
				});
		}
	}

	const result = await savePdf(pdf, { filePath: outputPath, base64: base64Output });
	return JSON.stringify(result);
}

// --- Tool Definitions ---

/**
 * Schema for generatePdfFromHtml.
 */
export const generatePdfFromHtmlSchema = z.object({
	html: z.string().describe("HTML string to convert to PDF"),
	filePath: z.string().describe("Output file path for the generated PDF"),
	options: z
		.object({
			format: z.string().optional().describe("Paper format (a4, letter, legal, etc.)"),
			margin: z
				.object({
					top: z.number().optional(),
					bottom: z.number().optional(),
					left: z.number().optional(),
					right: z.number().optional(),
				})
				.optional()
				.describe("Page margins in pixels"),
			orientation: z.enum(["portrait", "landscape"]).optional(),
			headerTemplate: z.string().optional().describe("HTML template for header"),
			footerTemplate: z.string().optional().describe("HTML template for footer"),
		})
		.optional()
		.describe("Optional page configuration"),
});

/**
 * Schema for generatePdfFromMarkdown.
 */
export const generatePdfFromMarkdownSchema = z.object({
	markdown: z.string().describe("Markdown string to convert to PDF"),
	filePath: z.string().describe("Output file path for the generated PDF"),
	css: z.string().optional().describe("Optional custom CSS styles"),
	options: z
		.object({
			format: z.string().optional(),
			margin: z
				.object({
					top: z.number().optional(),
					bottom: z.number().optional(),
					left: z.number().optional(),
					right: z.number().optional(),
				})
				.optional(),
			orientation: z.enum(["portrait", "landscape"]).optional(),
		})
		.optional(),
});

/**
 * Schema for mergePdfs.
 */
export const mergePdfsSchema = z.object({
	filePaths: z.array(z.string()).describe("Array of PDF file paths to merge"),
	outputPath: z.string().describe("Output file path for the merged PDF"),
	base64: z.boolean().optional().describe("Return result as base64 instead of writing to file"),
});

/**
 * Schema for splitPdf.
 */
export const splitPdfSchema = z.object({
	filePath: z.string().describe("Source PDF file path"),
	pageRange: z
		.string()
		.describe('Page range (e.g., "1-3" or "1,3,5") or "all" for individual pages'),
	outputPattern: z.string().optional().describe('Output path pattern (e.g., "output_%d.pdf")'),
	base64: z.boolean().optional().describe("Return results as base64 array"),
});

/**
 * Schema for addWatermark.
 */
export const addWatermarkSchema = z.object({
	filePath: z.string().optional().describe("Source PDF file path"),
	base64: z.string().optional().describe("Source PDF as base64"),
	text: z.string().optional().describe("Watermark text"),
	imagePath: z.string().optional().describe("Path to watermark image"),
	imageBase64: z.string().optional().describe("Base64 watermark image"),
	opacity: z.number().min(0).max(1).optional().default(DEFAULT_WATERMARK_OPACITY),
	rotation: z.number().optional().default(DEFAULT_WATERMARK_ROTATION),
	position: z
		.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"])
		.optional()
		.default("center"),
	pages: z.array(z.number()).optional().describe("Specific pages to watermark (1-indexed)"),
	outputPath: z.string().optional().describe("Output file path"),
	base64Output: z.boolean().optional().describe("Return result as base64"),
});

/**
 * Schema for embedSignature.
 */
export const embedSignatureSchema = z.object({
	filePath: z.string().optional().describe("Source PDF file path"),
	base64: z.string().optional().describe("Source PDF as base64"),
	text: z.string().optional().describe("Text signature"),
	imagePath: z.string().optional().describe("Path to signature image"),
	imageBase64: z.string().optional().describe("Base64 signature image"),
	page: z.number().min(1).describe("Page number (1-indexed)"),
	x: z.number().describe("X position"),
	y: z.number().describe("Y position"),
	width: z.number().optional().default(150),
	height: z.number().optional().default(50),
	fontOptions: z
		.object({
			name: z.string().optional(),
			size: z.number().optional(),
			color: z.string().optional(),
		})
		.optional(),
	outputPath: z.string().optional(),
	base64Output: z.boolean().optional(),
});

/**
 * Schema for addAnnotations.
 */
export const addAnnotationsSchema = z.object({
	filePath: z.string().optional().describe("Source PDF file path"),
	base64: z.string().optional().describe("Source PDF as base64"),
	annotations: z
		.array(
			z.object({
				type: z.enum(["note", "highlight", "stamp"]),
				page: z.number().min(1),
				position: z.object({
					x: z.number(),
					y: z.number(),
					width: z.number().optional(),
					height: z.number().optional(),
				}),
				content: z.string().optional(),
				color: z.string().optional(),
			}),
		)
		.describe("Array of annotation definitions"),
	outputPath: z.string().optional(),
	base64Output: z.boolean().optional(),
});

// --- Tool Instances ---

/**
 * LangChain Tool instance for generatePdfFromHtml.
 */
export const generatePdfFromHtmlTool = tool(generatePdfFromHtml, {
	name: "generatePdfFromHtml",
	description:
		"Generate a PDF file from an HTML string using headless Chromium. Supports custom page options (format, margin, orientation) and headers/footers.",
	schema: generatePdfFromHtmlSchema,
});

/**
 * LangChain Tool instance for generatePdfFromMarkdown.
 */
export const generatePdfFromMarkdownTool = tool(generatePdfFromMarkdown, {
	name: "generatePdfFromMarkdown",
	description:
		"Generate a PDF file from a markdown string by rendering it to HTML first. Supports custom CSS styles and page options.",
	schema: generatePdfFromMarkdownSchema,
});

/**
 * LangChain Tool instance for mergePdfs.
 */
export const mergePdfsTool = tool(mergePdfs, {
	name: "mergePdfs",
	description:
		"Merge multiple PDF files into a single PDF file. Accepts file paths or base64-encoded content.",
	schema: mergePdfsSchema,
});

/**
 * LangChain Tool instance for splitPdf.
 */
export const splitPdfTool = tool(splitPdf, {
	name: "splitPdf",
	description:
		"Split a PDF file into multiple PDFs by page range or individual pages. Supports page ranges like '1-3' or '1,3,5'.",
	schema: splitPdfSchema,
});

/**
 * LangChain Tool instance for addWatermark.
 */
export const addWatermarkTool = tool(addWatermark, {
	name: "addWatermark",
	description:
		"Add a text or image watermark to one or all pages of a PDF. Supports opacity, rotation, and positioning options.",
	schema: addWatermarkSchema,
});

/**
 * LangChain Tool instance for embedSignature.
 */
export const embedSignatureTool = tool(embedSignature, {
	name: "embedSignature",
	description:
		"Embed a signature (image or text) into a PDF at a specified location. Supports custom font options for text signatures.",
	schema: embedSignatureSchema,
});

/**
 * LangChain Tool instance for addAnnotations.
 */
export const addAnnotationsTool = tool(addAnnotations, {
	name: "addAnnotations",
	description:
		"Add annotations (highlights, notes, stamps) to specific pages and locations in a PDF.",
	schema: addAnnotationsSchema,
});

/**
 * All PDF generation/manipulation tools.
 * @type {object}
 */
export const pdfGenerateTools = {
	generatePdfFromHtml: generatePdfFromHtmlTool,
	generatePdfFromMarkdown: generatePdfFromMarkdownTool,
	mergePdfs: mergePdfsTool,
	splitPdf: splitPdfTool,
	addWatermark: addWatermarkTool,
	embedSignature: embedSignatureTool,
	addAnnotations: addAnnotationsTool,
};
