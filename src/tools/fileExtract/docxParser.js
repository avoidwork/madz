/**
 * DOCX to Markdown parser.
 * Converts DOCX document content to structured markdown.
 * @module fileExtract/docxParser
 */

import { extractZipXml } from "./zipExtractor.js";
import { ZipExtractionError } from "./zipExtractor.js";
import { parseStringPromise } from "xml2js";

/**
 * Convert DOCX XML content to markdown.
 * @param {string} documentXml - The word/document.xml content
 * @returns {string} Markdown string
 */
export function docxToMarkdown(documentXml) {
	if (!documentXml || !documentXml.trim()) {
		return "";
	}

	let markdown = "";
	let inList = false;
	let listType = null;

	try {
		const parsed = parseStringPromise(documentXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const body = parsed?.w?.document?.[0]?.["w:body"] || parsed?.w?.document?.["w:body"];
		if (!body) return "";

		const paragraphs = body["w:p"] || [];

		for (const para of paragraphs) {
			const textContent = extractParagraphText(para);
			const headingLevel = getHeadingLevel(para);
			const isListItem = isListItem(para);

			if (headingLevel > 0) {
				// Close any open list
				if (inList) {
					markdown += "\n";
					inList = false;
					listType = null;
				}
				markdown += `${"#".repeat(headingLevel)} ${textContent}\n\n`;
			} else if (isListItem) {
				if (!inList) {
					inList = true;
					listType = "ul";
				}
				markdown += `- ${textContent}\n`;
			} else if (textContent.trim()) {
				if (inList) {
					markdown += "\n";
					inList = false;
					listType = null;
				}
				markdown += `${textContent}\n\n`;
			}
		}
	} catch {
		// If XML parsing fails, return raw text
		const textMatch = documentXml.match(/>([^<]+)</g);
		if (textMatch) {
			markdown = textMatch.map((m) => m.replace(/^>|</g, "")).join(" ").trim();
		}
	}

	return markdown.trim();
}

/**
 * Extract all text content from a paragraph element.
 * @param {object} para - Parsed paragraph XML object
 * @returns {string} Text content
 */
function extractParagraphText(para) {
	const runs = para["w:r"] || [];
	let text = "";

	for (const run of runs) {
		const tElements = run["w:t"];
		const texts = Array.isArray(tElements) ? tElements : tElements ? [tElements] : [];
		for (const t of texts) {
			const content = t._ || t;
			if (content) {
				text += content;
			}
		}
	}

	return text.trim();
}

/**
 * Determine the heading level from paragraph style.
 * @param {object} para - Parsed paragraph XML object
 * @returns {number} Heading level (0 = not a heading)
 */
function getHeadingLevel(para) {
	const pPr = para["w:pPr"];
	if (!pPr) return 0;

	const style = pPr["w:pStyle"];
	if (!style) return 0;

	const val = style._ || style;
	if (typeof val !== "string") return 0;

	const match = val.match(/Heading(\d)/);
	if (match) {
		return Math.min(parseInt(match[1], 10), 6);
	}

	if (val === "Title") return 1;
	if (val === "Subtitle") return 2;

	return 0;
}

/**
 * Check if a paragraph is a list item.
 * @param {object} para - Parsed paragraph XML object
 * @returns {boolean}
 */
function isListItem(para) {
	const pPr = para["w:pPr"];
	if (!pPr) return false;

	const numPr = pPr["w:numPr"];
	return !!numPr;
}

/**
 * Extract tables from DOCX and convert to markdown.
 * @param {string} documentXml - The word/document.xml content
 * @returns {string} Markdown tables
 */
export function extractDocxTables(documentXml) {
	if (!documentXml) return "";

	let markdown = "";

	try {
		const parsed = parseStringPromise(documentXml, {
			mergeAttrs: true,
			explicitArray: false,
		});

		const body = parsed?.w?.document?.[0]?.["w:body"] || parsed?.w?.document?.["w:body"];
		if (!body) return "";

		const tables = body["w:tbl"];
		const tableArray = Array.isArray(tables) ? tables : tables ? [tables] : [];

		for (const table of tableArray) {
			const rows = table["w:tr"] || [];
			const rowArray = Array.isArray(rows) ? rows : [rows];

			const cells = [];
			for (const row of rowArray) {
				const rowCells = row["w:tc"] || [];
				const cellArray = Array.isArray(rowCells) ? rowCells : [rowCells];
				const rowData = [];

				for (const cell of cellArray) {
					const cellText = extractParagraphText(cell["w:p"] || []);
					rowData.push(cellText || "");
				}

				cells.push(rowData);
			}

			if (cells.length > 0) {
				markdown += "\n| " + cells[0].join(" | ") + " |\n";
				markdown += "| " + cells[0].map(() => "---").join(" | ") + " |\n";
				for (let i = 1; i < cells.length; i++) {
					markdown += "| " + cells[i].join(" | ") + " |\n";
				}
				markdown += "\n";
			}
		}
	} catch {
		// Silently skip table extraction on parse errors
	}

	return markdown;
}
