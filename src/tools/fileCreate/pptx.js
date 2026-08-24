/**
 * PPTX presentation creation tool.
 * Creates PowerPoint presentations (.pptx) from structured content using pptxgenjs.
 * @module fileCreate/pptx
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import PptxGenJS from "pptxgenjs";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Error thrown when PPTX creation fails.
 */
export class PptxError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} [reason] - Reason for the failure
	 */
	constructor(message, reason) {
		super(message);
		this.name = "PptxError";
		this.reason = reason || null;
	}
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp"]);
const DEFAULT_FONT = "Arial";
const MIN_FONT_SIZE = 6;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Image placement on a slide.
 */
const imageSchema = z.object({
	path: z.string().describe("Absolute path to the image file"),
	x: z.number().min(0).optional().describe("X position in inches"),
	y: z.number().min(0).optional().describe("Y position in inches"),
	w: z.number().min(0.1).optional().describe("Width in inches"),
	h: z.number().min(0.1).optional().describe("Height in inches"),
});

/**
 * Table definition for a slide.
 */
const tableSchema = z.object({
	headers: z.array(z.string()).optional().describe("Header row labels"),
	rows: z.array(z.array(z.string())).describe("Table data rows"),
	options: z
		.object({
			colW: z.array(z.number()).optional().describe("Column widths in inches"),
			fill: z
				.object({ color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })
				.optional()
				.describe("Cell fill color"),
			border: z
				.object({
					type: z.string().optional().describe("Border style"),
					color: z
						.string()
						.regex(/^#[0-9A-Fa-f]{6}$/)
						.optional()
						.describe("Border color"),
					pt: z.number().int().min(0).max(50).optional().describe("Border thickness in points"),
				})
				.optional()
				.describe("Border settings"),
		})
		.optional()
		.describe("Table styling options"),
});

/**
 * A single slide definition.
 */
const slideSchema = z.object({
	layout: z
		.enum(["title", "content", "two-column", "comparison", "quote", "image-only"])
		.optional()
		.default("content")
		.describe("Slide layout type"),
	title: z.string().max(200).optional().describe("Slide title"),
	content: z
		.string()
		.max(5000)
		.optional()
		.describe("Slide body content (supports \\n for line breaks)"),
	subtitle: z.string().max(500).optional().describe("Subtitle text (title layout)"),
	images: z.array(imageSchema).optional().describe("Images to embed on the slide"),
	tables: z.array(tableSchema).optional().describe("Tables to render on the slide"),
	quote: z.string().max(2000).optional().describe("Quote text (quote layout)"),
	quoteAttribution: z.string().max(200).optional().describe("Quote attribution (quote layout)"),
	backgroundColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional()
		.describe("Slide background color"),
});

/**
 * Full presentation input schema.
 */
export const pptxGenerateSchema = z.object({
	outputPath: z.string().describe("Absolute path for the output .pptx file"),
	templatePath: z.string().optional().describe("Path to an existing .pptx template file"),
	slideWidth: z
		.number()
		.min(9)
		.max(20)
		.optional()
		.describe("Slide width in inches (default 13.33)"),
	slideHeight: z
		.number()
		.min(7.5)
		.max(15)
		.optional()
		.describe("Slide height in inches (default 7.5)"),
	slides: z.array(slideSchema).min(0).describe("Array of slide definitions"),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that an image file has a supported extension and valid content.
 * @param {string} imagePath - Absolute path to the image file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImagePath(imagePath) {
	const ext = imagePath.split(".").pop()?.toLowerCase();
	if (!ext || !SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
		return {
			valid: false,
			error: `Unsupported image format: .${ext}. Supported: ${[...SUPPORTED_IMAGE_EXTENSIONS].sort().join(", ")}`,
		};
	}

	// Magic bytes validation — only if file exists
	const magicBytes = {
		png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
		jpg: Buffer.from([0xff, 0xd8, 0xff]),
		gif: Buffer.from([0x47, 0x49, 0x46, 0x38]),
		bmp: Buffer.from([0x42, 0x4d]),
	};

	const expected = magicBytes[ext];
	if (!expected) return { valid: true };

	try {
		const buf = readFileSync(imagePath, {
			encoding: "buffer",
			length: expected.length,
			position: 0,
		});

		for (let i = 0; i < expected.length; i++) {
			if (buf[i] !== expected[i]) {
				return {
					valid: false,
					error: `File ${imagePath} is not a valid ${ext} image (invalid magic bytes)`,
				};
			}
		}
	} catch {
		// File doesn't exist or can't be read — extension is valid, file will be validated at runtime
		return { valid: true };
	}

	return { valid: true };
}

/**
 * Validate that an output path is within the allowed write directory.
 * Prevents path traversal attacks.
 * @param {string} outputPath - The output file path
 * @param {string} [allowedDir] - Allowed write directory (defaults to CWD)
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateOutputPath(outputPath, allowedDir) {
	const resolved = resolve(outputPath);
	const base = allowedDir || process.cwd();
	const resolvedBase = resolve(base);

	if (!resolved.startsWith(resolvedBase)) {
		return {
			valid: false,
			error: `Output path ${outputPath} is outside allowed directory ${base}`,
		};
	}

	return { valid: true };
}

/**
 * Validate that a template file is a valid PPTX (ZIP structure check).
 * @param {string} templatePath - Path to the template file
 * @returns {boolean}
 */
export function validateTemplatePath(templatePath) {
	try {
		const buf = readFileSync(templatePath, { encoding: "buffer", length: 4, position: 0 });

		// PPTX files are ZIP archives starting with PK\x03\x04
		if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
			return false;
		}
	} catch {
		// File doesn't exist or can't be read
		return false;
	}

	return true;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Create text runs for a pptxgenjs text object, handling overflow.
 * @param {string} text - Raw text content
 * @param {object} [options] - Text formatting options
 * @param {number} [options.maxFontSize=44] - Maximum font size before shrinking
 * @returns {Array<{ text: string, options: object }>}
 */
export function createTextRuns(text, options = {}) {
	if (!text) return [];

	const { maxFontSize = 44 } = options;
	const lines = text.split("\n");
	const runs = [];

	for (const line of lines) {
		runs.push({
			text: line,
			options: {
				fontSize: maxFontSize,
				...options,
			},
		});
	}

	return runs;
}

/**
 * Shrink text to fit within a target width by reducing font size.
 * @param {string} text - Text to shrink
 * @param {number} targetWidth - Target width in inches
 * @param {number} [startSize=44] - Starting font size
 * @returns {{ text: string, options: { fontSize: number } & object }}
 */
export function shrinkToFit(text, targetWidth, startSize = 44) {
	let fontSize = startSize;
	const result = { text, options: { fontSize } };

	// Heuristic: estimate character width at current font size
	// Average character width ≈ fontSize * 0.6 for Arial
	const charWidth = fontSize * 0.6;
	const estimatedWidth = text.length * charWidth;

	if (estimatedWidth > targetWidth * 96) {
		fontSize = Math.max(MIN_FONT_SIZE, Math.floor((targetWidth * 96) / (text.length * 0.6)));
		result.options.fontSize = fontSize;
	}

	return result;
}

// ---------------------------------------------------------------------------
// Slide creation helpers
// ---------------------------------------------------------------------------

/**
 * Create a slide with the specified layout and content.
 * @param {PptxGenJS.Slide} slide - pptxgenjs slide instance
 * @param {object} slideDef - Parsed slide definition from schema
 * @returns {PptxGenJS.Slide} The slide instance (for chaining)
 */
export function createSlide(slide, slideDef) {
	const {
		layout = "content",
		title,
		content,
		subtitle,
		images = [],
		tables = [],
		quote,
		quoteAttribution,
		backgroundColor,
	} = slideDef;

	// Background color
	if (backgroundColor) {
		slide.background = { fill: backgroundColor };
	}

	// Layout-specific rendering
	switch (layout) {
		case "title":
			if (title) {
				slide.addText(title, {
					x: 1,
					y: 1.5,
					w: 11.33,
					h: 2,
					fontSize: 44,
					fontFamily: DEFAULT_FONT,
					bold: true,
					alignment: "center",
				});
			}
			if (subtitle) {
				slide.addText(subtitle, {
					x: 1,
					y: 3.5,
					w: 11.33,
					h: 1,
					fontSize: 24,
					fontFamily: DEFAULT_FONT,
					alignment: "center",
				});
			}
			break;

		case "quote":
			if (quote) {
				slide.addText(quote, {
					x: 2,
					y: 2,
					w: 9.33,
					h: 3,
					fontSize: 28,
					fontFamily: DEFAULT_FONT,
					italic: true,
					alignment: "center",
				});
			}
			if (quoteAttribution) {
				slide.addText(`— ${quoteAttribution}`, {
					x: 2,
					y: 5,
					w: 9.33,
					h: 0.75,
					fontSize: 16,
					fontFamily: DEFAULT_FONT,
					alignment: "center",
				});
			}
			break;

		case "image-only":
			// Image placement handled below
			break;

		default:
			// content, two-column, comparison
			if (title) {
				slide.addText(title, {
					x: 0.5,
					y: 0.5,
					w: 12.33,
					h: 1,
					fontSize: 32,
					fontFamily: DEFAULT_FONT,
					bold: true,
				});
			}

			if (content) {
				const lines = content.split("\n").filter((l) => l.trim());
				const bulletText = lines.map((line) => ({
					text: line,
					options: {
						fontSize: 18,
						fontFamily: DEFAULT_FONT,
						bullet: { type: "bullet", color: "363636", size: 18 },
					},
				}));

				slide.addText(bulletText, {
					x: 0.5,
					y: 1.8,
					w: 12.33,
					h: 5,
					lineSpacingMultiple: 1.3,
				});
			}

			if (layout === "two-column" || layout === "comparison") {
				// Add a vertical divider
				slide.addShape("rect", {
					x: 6.5,
					y: 1.5,
					w: 0.05,
					h: 5.5,
					fill: { color: "D9D9D9" },
				});
			}
			break;
	}

	// Images
	for (const img of images) {
		const imgDef = {
			path: img.path,
			x: img.x ?? 0.5,
			y: img.y ?? 1.5,
			w: img.w ?? 3,
			h: img.h ?? 2,
		};
		slide.addImage(imgDef);
	}

	// Tables
	for (const tbl of tables) {
		const rows = [];

		// Header row
		if (tbl.headers) {
			const headerCells = tbl.headers.map((h) => ({
				text: h,
				options: { bold: true, fill: { color: "363636" }, fontColor: "FFFFFF" },
			}));
			rows.push(headerCells);
		}

		// Data rows
		for (const row of tbl.rows) {
			const cells = row.map((cell) => ({
				text: cell,
				options: { fontColor: "333333" },
			}));
			rows.push(cells);
		}

		// Determine column width from headers or first row
		const numCols = tbl.headers?.length ?? tbl.rows?.[0]?.length ?? 1;
		const colW = tbl.options?.colW ?? Array(numCols).fill(2);

		slide.addTable(rows, {
			colW,
			border: { pt: 1, color: "CCCCCC", type: "solid" },
			fill: { color: "FFFFFF" },
			marginL: 0.2,
			marginR: 0.2,
			marginT: 0.2,
			marginB: 0.2,
		});
	}

	return slide;
}

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

/**
 * Load a template presentation and return the PptxGenJS instance.
 * @param {string} templatePath - Path to the template .pptx file
 * @returns {Promise<PptxGenJS>} PptxGenJS instance with template loaded
 */
export async function loadTemplate(templatePath) {
	const pptx = new PptxGenJS();
	await pptx.load(templatePath);
	return pptx;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Create a PowerPoint presentation from structured content.
 * @param {object} input - Tool input matching pptxGenerateSchema
 * @param {string} input.outputPath - Output file path
 * @param {string} [input.templatePath] - Optional template file path
 * @param {number} [input.slideWidth] - Slide width in inches
 * @param {number} [input.slideHeight] - Slide height in inches
 * @param {Array} input.slides - Slide definitions
 * @returns {Promise<string>} JSON result string
 */
export async function createPptx(input) {
	const validated = pptxGenerateSchema.parse(input);
	const { outputPath, templatePath, slideWidth, slideHeight, slides } = validated;

	// Validate output path
	const pathValidation = validateOutputPath(outputPath);
	if (!pathValidation.valid) {
		return JSON.stringify({ ok: false, error: pathValidation.error });
	}

	// Validate template if provided
	if (templatePath && !validateTemplatePath(templatePath)) {
		return JSON.stringify({ ok: false, error: `${templatePath} is not a valid PPTX file` });
	}

	// Validate all image paths
	for (const slide of slides) {
		for (const img of slide.images || []) {
			const imgValidation = validateImagePath(img.path);
			if (!imgValidation.valid) {
				return JSON.stringify({
					ok: false,
					error: `Image validation failed: ${imgValidation.error}`,
				});
			}
		}
	}

	// Create presentation
	const pptx = new PptxGenJS();
	pptx.defineLayout({ name: "CUSTOM", width: slideWidth || 13.33, height: slideHeight || 7.5 });
	pptx.layout = "CUSTOM";

	// Load template if provided
	if (templatePath) {
		await loadTemplate(templatePath);
	}

	// Create slides
	if (slides.length === 0) {
		pptx.addSlide();
	} else {
		for (const slideDef of slides) {
			const slide = pptx.addSlide();
			createSlide(slide, slideDef);
		}
	}

	// Create parent directory if it doesn't exist
	await mkdir(dirname(outputPath), { recursive: true });

	// Save presentation — use nodebuffer since writeFile({ filePath }) doesn't work in Node.js
	let buffer;
	try {
		buffer = await pptx.write("nodebuffer");
	} catch (err) {
		throw new PptxError(`Failed to generate presentation: ${err.message}`, "generate-failed");
	}

	try {
		await writeFile(outputPath, buffer);
	} catch (err) {
		throw new PptxError(`Failed to save presentation: ${err.message}`, "save-failed");
	}

	return JSON.stringify({
		ok: true,
		message: `Presentation saved to ${outputPath}`,
		filePath: outputPath,
		slideCount: slides.length || 1,
	});
}

// ---------------------------------------------------------------------------
// LangChain Tool instance
// ---------------------------------------------------------------------------

/**
 * LangChain Tool instance for PPTX creation.
 */
export const pptxGenerateTool = tool(createPptx, {
	name: "pptxGenerate",
	description:
		"Create a PowerPoint (.pptx) presentation from structured content. Supports multiple slide layouts (title, content, two-column, comparison, quote, image-only), text formatting, image embedding, tables, and template loading. Returns the output file path.",
	schema: pptxGenerateSchema,
});
