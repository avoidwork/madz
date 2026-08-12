/**
 * DOCX file extraction tool.
 * Extracts content from Microsoft Word documents (.docx) to markdown.
 * @module fileExtract/docx
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { extractZipXml } from "./zipExtractor.js";
import { docxToMarkdown, extractDocxTables } from "./docxParser.js";
import { validateFormat, getExtension } from "./formatValidator.js";

/**
 * Input schema for the docx tool.
 */
export const docxSchema = z.object({
	filePath: z.string().describe("Absolute path to the .docx file"),
});

/**
 * Extract content from a DOCX file.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Path to the DOCX file
 * @returns {Promise<string>} JSON result string
 */
export async function docxExtract(input) {
	const { filePath } = docxSchema.parse(input);

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

	// Extract document content
	const documentXml = zipContent.get("word/document.xml");
	if (!documentXml) {
		return JSON.stringify({ ok: false, error: "No word/document.xml found in archive" });
	}

	const markdown = docxToMarkdown(documentXml);
	const tables = extractDocxTables(documentXml);
	const content = markdown + tables;

	return JSON.stringify({
		ok: true,
		format: "markdown",
		content: content || "(empty document)",
	});
}

/**
 * LangChain Tool instance for DOCX extraction.
 */
export const docxTool = tool(docxExtract, {
	name: "docx",
	description: "Extract content from a Microsoft Word (.docx) file to markdown. Accepts a file path and returns structured markdown with headings, paragraphs, lists, and tables.",
	schema: docxSchema,
});
