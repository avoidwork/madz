import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { validatePath, parseSizeString } from "../common.js";

// MIME type map for common image extensions.
const MIME_TYPES = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".bmp": "image/bmp",
	".svg": "image/svg+xml",
	".avif": "image/avif",
	".tiff": "image/tiff",
	".tif": "image/tiff",
	".ico": "image/x-icon",
};

/**
 * Detect the MIME type of an image from its file extension.
 * @param {string} filePath - The image file path
 * @returns {string} The MIME type, or "application/octet-stream" if unknown
 */
function detectMimeType(filePath) {
	const ext = extname(filePath).toLowerCase();
	return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Read an image file from disk and return its base64-encoded contents.
 * Validates the path against the sandbox allowlist and enforces a configurable
 * size limit (`image.maxSize`, default `100kb`). Uses async `node:fs/promises`.
 * @param {z.infer<typeof ReadImageSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @param {string} [options.maxReadSize] - Fallback size limit (overridden by config.image.maxSize)
 * @returns {Promise<string>} JSON result string
 */
export async function readImageImpl(input, options = {}) {
	const { path: filePath, maxSize } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Path is required and must be a non-empty string" });
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];
	const sizeLimit = maxSize || config.image?.maxSize || "100kb";

	// Validate the path against the sandbox allowlist
	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return JSON.stringify({ ok: false, error: validation.error });
	}

	// Check the file exists and its size
	let stats;
	try {
		stats = await stat(validation.path);
	} catch (_err) {
		return JSON.stringify({ ok: false, error: `File not found: ${filePath}` });
	}

	const maxSizeBytes = parseSizeString(sizeLimit);
	if (stats.size > maxSizeBytes) {
		return JSON.stringify({
			ok: false,
			error: `File size (${stats.size} bytes) exceeds max read size (${sizeLimit}).`,
		});
	}

	// Read the file and encode as base64
	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Failed to read file: ${err.message}` });
	}

	return JSON.stringify({
		ok: true,
		mimeType: detectMimeType(validation.path),
		data: buffer.toString("base64"),
	});
}

const ReadImageSchema = z.object({
	path: z.string().min(1).describe("Path to the image file to read"),
	maxSize: z.string().optional().describe("Override the max file size limit (e.g., '200kb')"),
});

export const readImage = tool(readImageImpl, {
	name: "readImage",
	description:
		"Read an image file from disk and return its base64-encoded contents plus MIME type, " +
		"so it can be passed directly to an LLM for vision analysis. Use this tool for ANY task " +
		"requiring vision — reading a screenshot, inspecting a diagram, or sending an image to the LLM. " +
		"Do NOT use read_file for images: read_file returns raw octet-stream binary that poisons the " +
		"session and errors the inference provider. Validates the path against the sandbox allowlist " +
		"and enforces a configurable size limit (image.maxSize, default 100kb). Uses async file system operations.",
	schema: ReadImageSchema,
});
