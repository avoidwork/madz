import { readFile, stat } from "node:fs/promises";
import { getDefaultMaxFileSize, hasNullBytes, isBinaryPath, isSecretFile } from "./fileFilters.js";

/**
 * Split source file content into fixed-size chunks with overlap.
 *
 * Handles CRLF line endings and ignores the phantom empty line produced by a
 * trailing newline.
 *
 * @param {string} filePath - Path to the source file
 * @param {string} content - Full file content
 * @param {number} [chunkSize=96] - Number of lines per chunk (> 0)
 * @param {number} [overlap=16] - Number of overlapping lines between chunks (0 <= overlap < chunkSize)
 * @returns {Array<{filePath: string, lineStart: number, lineEnd: number, content: string}>}
 */
export function chunkContent(filePath, content, chunkSize = 96, overlap = 16) {
	if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
		throw new RangeError(`chunkSize must be a positive integer, got ${chunkSize}`);
	}
	if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
		throw new RangeError(
			`overlap must be an integer with 0 <= overlap < chunkSize, got ${overlap}`,
		);
	}

	if (!content || content.length === 0) {
		return [];
	}

	const lines = content.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
	if (lines.length > 1 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	const totalLines = lines.length;
	const chunks = [];
	const step = chunkSize - overlap;

	if (totalLines <= chunkSize) {
		chunks.push({
			filePath,
			lineStart: 1,
			lineEnd: totalLines,
			content: lines.join("\n"),
		});
		return chunks;
	}

	for (let start = 0; start < totalLines; start += step) {
		const end = Math.min(start + chunkSize, totalLines);
		chunks.push({
			filePath,
			lineStart: start + 1,
			lineEnd: end,
			content: lines.slice(start, end).join("\n"),
		});

		if (end >= totalLines) {
			break;
		}
	}

	return chunks;
}

/**
 * Chunk a file from disk, skipping binary/secret files and files exceeding the size limit.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {object} [options] - Chunking options
 * @param {number} [options.chunkSize=96] - Number of lines per chunk
 * @param {number} [options.overlap=16] - Number of overlapping lines
 * @param {number} [options.maxFileSize] - Maximum file size in bytes (default: `vector.maxFileSize`)
 * @returns {Promise<Array<{filePath: string, lineStart: number, lineEnd: number, content: string}>>}
 */
export async function chunkFile(filePath, options = {}) {
	const { chunkSize = 96, overlap = 16, maxFileSize = getDefaultMaxFileSize() } = options;

	if (isBinaryPath(filePath) || isSecretFile(filePath)) {
		return [];
	}

	try {
		const stats = await stat(filePath);
		if (stats.size > maxFileSize) {
			return [];
		}
	} catch (_err) {
		return [];
	}

	let content;
	try {
		content = await readFile(filePath, "utf-8");
	} catch (_err) {
		return [];
	}

	if (hasNullBytes(content)) {
		return [];
	}

	return chunkContent(filePath, content, chunkSize, overlap);
}
