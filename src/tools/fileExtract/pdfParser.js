/**
 * PDF to Markdown parser.
 * Extracts text content from PDF files and outputs markdown.
 * @module fileExtract/pdfParser
 */

import { PDFParse } from "pdf-parse";

/**
 * Error thrown when PDF extraction fails.
 */
export class PdfExtractionError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} [reason] - Reason for the failure
	 */
	constructor(message, reason) {
		super(message);
		this.name = "PdfExtractionError";
		this.reason = reason || null;
	}
}

/**
 * Convert PDF buffer to markdown.
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Markdown string
 */
export async function pdfToMarkdown(buffer) {
	if (!buffer || buffer.length === 0) {
		return "";
	}

	try {
		const parser = new PDFParse({ verbosity: 0 });
		const result = await parser.getText();

		if (!result.text || !result.text.trim()) {
			await parser.destroy();
			throw new PdfExtractionError("No extractable text found in PDF", "no-text");
		}

		// Clean up the extracted text into markdown paragraphs
		const paragraphs = result.text
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);

		const markdown = paragraphs.join("\n\n");
		await parser.destroy();
		return markdown;
	} catch (err) {
		if (err instanceof PdfExtractionError) throw err;

		// Check for password-protected PDF
		if (err.message && err.message.toLowerCase().includes("password")) {
			throw new PdfExtractionError("PDF is password-protected", "password-protected");
		}

		throw new PdfExtractionError(`PDF extraction failed: ${err.message}`, "extraction-failed");
	}
}
