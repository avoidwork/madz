/**
 * PDF file extraction tool.
 * Extracts text content from PDF files to markdown.
 * @module fileExtract/pdf
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { pdfToMarkdown, PdfExtractionError } from "./pdfParser.js";
import { validateFormat } from "./formatValidator.js";

/**
 * Input schema for the pdf tool.
 */
export const pdfSchema = z.object({
	filePath: z.string().describe("Absolute path to the .pdf file"),
});

/**
 * Extract content from a PDF file.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Path to the PDF file
 * @returns {Promise<string>} JSON result string
 */
export async function pdfExtract(input) {
	const { filePath } = pdfSchema.parse(input);

	// Validate format
	const validation = validateFormat(filePath);
	if (!validation.valid) {
		return JSON.stringify({ ok: false, error: validation.error });
	}

	// Read file
	let buffer;
	try {
		buffer = await readFile(filePath);
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Failed to read file: ${err.message}` });
	}

	// Extract text
	let markdown;
	try {
		markdown = await pdfToMarkdown(buffer);
	} catch (err) {
		if (err instanceof PdfExtractionError) {
			return JSON.stringify({
				ok: false,
				error: err.message,
				reason: err.reason,
			});
		}
		return JSON.stringify({ ok: false, error: `PDF extraction failed: ${err.message}` });
	}

	return JSON.stringify({
		ok: true,
		format: "markdown",
		content: markdown || "(no extractable text)",
	});
}

/**
 * LangChain Tool instance for PDF extraction.
 */
export const pdfTool = tool(pdfExtract, {
	name: "pdf",
	description:
		"Extract text content from a PDF file to markdown. Handles multi-page documents, Unicode characters, and special characters. Returns an error for scanned/image-only PDFs.",
	schema: pdfSchema,
});
