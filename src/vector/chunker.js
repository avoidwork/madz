import { readFile, stat } from "node:fs/promises";

/**
 * Binary file extensions to skip during chunking.
 */
const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".ico",
	".webp",
	".avif",
	".mp3",
	".wav",
	".ogg",
	".flac",
	".aac",
	".wma",
	".mp4",
	".avi",
	".mkv",
	".mov",
	".wmv",
	".webm",
	".zip",
	".tar",
	".gz",
	".bz2",
	".xz",
	".7z",
	".rar",
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".ttf",
	".otf",
	".woff",
	".woff2",
	".eot",
	".o",
	".so",
	".dll",
	".dylib",
	".exe",
	".wasm",
	".pyc",
	".pyo",
	".pyd",
	".DS_Store",
	".gitkeep",
]);

/**
 * Check if a file path has a binary extension.
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if the file extension is in the binary list
 */
function hasBinaryExtension(filePath) {
	const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if content contains null bytes (binary content heuristic).
 * @param {string} content - File content as string
 * @returns {boolean} True if null bytes are found
 */
function hasNullBytes(content) {
	return content.includes("\0");
}

/**
 * Split source file content into fixed-size chunks with overlap.
 *
 * @param {string} filePath - Path to the source file
 * @param {string} content - Full file content
 * @param {number} [chunkSize=96] - Number of lines per chunk
 * @param {number} [overlap=16] - Number of overlapping lines between chunks
 * @returns {Array<{filePath: string, lineStart: number, lineEnd: number, content: string}>}
 */
export function chunkContent(filePath, content, chunkSize = 96, overlap = 16) {
	if (!content || content.length === 0) {
		return [];
	}

	const lines = content.split("\n");
	const totalLines = lines.length;
	const chunks = [];
	const step = chunkSize - overlap;

	if (totalLines <= chunkSize) {
		chunks.push({
			filePath,
			lineStart: 1,
			lineEnd: totalLines,
			content,
		});
		return chunks;
	}

	for (let start = 0; start < totalLines; start += step) {
		const end = Math.min(start + chunkSize, totalLines);
		const chunkLines = lines.slice(start, end);
		chunks.push({
			filePath,
			lineStart: start + 1,
			lineEnd: end,
			content: chunkLines.join("\n"),
		});

		if (end >= totalLines) {
			break;
		}
	}

	return chunks;
}

/**
 * Chunk a file from disk, skipping binary files and files exceeding the size limit.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {object} [options] - Chunking options
 * @param {number} [options.chunkSize=96] - Number of lines per chunk
 * @param {number} [options.overlap=16] - Number of overlapping lines
 * @param {number} [options.maxFileSize=524288] - Maximum file size in bytes
 * @returns {Promise<Array<{filePath: string, lineStart: number, lineEnd: number, content: string}>>}
 */
export async function chunkFile(filePath, options = {}) {
	const { chunkSize = 96, overlap = 16, maxFileSize = 524288 } = options;

	// Skip binary extensions
	if (hasBinaryExtension(filePath)) {
		return [];
	}

	// Check file size
	try {
		const stats = await stat(filePath);
		if (stats.size > maxFileSize) {
			return [];
		}
	} catch (_err) {
		// File doesn't exist or can't be read — skip
		return [];
	}

	// Read file content
	let content;
	try {
		content = await readFile(filePath, "utf-8");
	} catch (_err) {
		return [];
	}

	// Skip if content has null bytes (binary content)
	if (hasNullBytes(content)) {
		return [];
	}

	return chunkContent(filePath, content, chunkSize, overlap);
}
