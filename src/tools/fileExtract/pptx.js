/**
 * PPTX file extraction tool.
 * Extracts content from PowerPoint presentations (.pptx) to markdown.
 * @module fileExtract/pptx
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { extractZipXml } from "./zipExtractor.js";
import { pptxToMarkdown } from "./pptxParser.js";
import { validateFormat } from "./formatValidator.js";

/**
 * Input schema for the pptx tool.
 */
export const pptxSchema = z.object({
	filePath: z.string().describe("Absolute path to the .pptx file"),
});

/**
 * Extract content from a PPTX file.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Path to the PPTX file
 * @returns {Promise<string>} JSON result string
 */
export async function pptxExtract(input) {
	const { filePath } = pptxSchema.parse(input);

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

	// Extract ZIP content
	let zipContent;
	try {
		zipContent = await extractZipXml(filePath);
	} catch (err) {
		return JSON.stringify({ ok: false, error: `ZIP extraction failed: ${err.message}` });
	}

	// Extract presentation content
	const markdown = pptxToMarkdown(zipContent);

	return JSON.stringify({
		ok: true,
		format: "markdown",
		content: markdown || "(empty presentation)",
	});
}

/**
 * LangChain Tool instance for PPTX extraction.
 */
export const pptxTool = tool(pptxExtract, {
	name: "pptx",
	description: "Extract content from a PowerPoint (.pptx) file to markdown. Returns slide titles, bullet points, and speaker notes.",
	schema: pptxSchema,
});
