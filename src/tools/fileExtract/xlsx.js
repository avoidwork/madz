/**
 * XLSX file extraction tool.
 * Extracts content from Excel spreadsheets (.xlsx) to markdown tables and JSON.
 * @module fileExtract/xlsx
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { extractZipXml } from "./zipExtractor.js";
import { xlsxToMarkdown } from "./xlsxParser.js";
import { xlsxToJson } from "./xlsxJson.js";
import { validateFormat } from "./formatValidator.js";

/**
 * Input schema for the xlsx tool.
 */
export const xlsxSchema = z.object({
	filePath: z.string().describe("Absolute path to the .xlsx file"),
	format: z.enum(["markdown", "json"]).optional().default("markdown").describe("Output format: 'markdown' for tables, 'json' for structured data"),
});

/**
 * Extract content from an XLSX file.
 * @param {object} input - Tool input
 * @param {string} input.filePath - Path to the XLSX file
 * @param {"markdown"|"json"} [input.format="markdown"] - Output format
 * @returns {Promise<string>} JSON result string
 */
export async function xlsxExtract(input) {
	const { filePath, format = "markdown" } = xlsxSchema.parse(input);

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

	if (format === "json") {
		const jsonData = xlsxToJson(zipContent);
		return JSON.stringify({
			ok: true,
			format: "json",
			content: JSON.stringify(jsonData, null, 2),
		});
	}

	const markdown = xlsxToMarkdown(zipContent);

	return JSON.stringify({
		ok: true,
		format: "markdown",
		content: markdown || "(empty spreadsheet)",
	});
}

/**
 * LangChain Tool instance for XLSX extraction.
 */
export const xlsxTool = tool(xlsxExtract, {
	name: "xlsx",
	description: "Extract content from an Excel (.xlsx) file. Supports markdown table output (default) or JSON output. Returns sheet data as tables or structured JSON objects.",
	schema: xlsxSchema,
});
