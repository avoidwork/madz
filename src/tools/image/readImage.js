import { tool } from "@langchain/core/tools";
import { z } from "zod";
import sharp from "sharp";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { validatePath } from "../common.js";
import { sendImageImpl } from "./sendImage.js";

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

const DEFAULT_MAX_DIMENSION = 5000;

/**
 * Downscale a raster image so neither width nor height exceeds `maxDimension`,
 * preserving aspect ratio and never enlarging. SVG and undecodable inputs are
 * returned unchanged.
 * @param {Buffer} buffer - Image bytes
 * @param {string} mimeType - Image MIME type
 * @param {number} maxDimension - Maximum width/height in pixels
 * @returns {Promise<Buffer>} The original or resized bytes
 */
async function constrainDimensions(buffer, mimeType, maxDimension) {
	if (mimeType === "image/svg+xml" || mimeType === "application/octet-stream") return buffer;
	try {
		const { width, height } = await sharp(buffer).metadata();
		if (!width || !height || (width <= maxDimension && height <= maxDimension)) return buffer;
		return await sharp(buffer)
			.resize({
				width: maxDimension,
				height: maxDimension,
				fit: "inside",
				withoutEnlargement: true,
			})
			.toBuffer();
	} catch (_err) {
		return buffer;
	}
}

/**
 * Read an image file from disk and return its base64-encoded contents.
 * Validates the path against the sandbox allowlist and enforces a configurable
 * size limit (`image.maxSize`, default `100000` bytes). The limit is applied to
 * the base64-encoded output, so the raw file may be up to `maxSize * 1.33` bytes
 * (base64 expands bytes by ~1.33x). Uses async `node:fs/promises`.
 * @param {z.infer<typeof ReadImageSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<Array|string>} `[image_url block]` on success; a JSON error string on failure
 */
export async function readImageImpl(input, options = {}) {
	const { path: filePath, maxSize } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Path is required and must be a non-empty string" });
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];
	const sizeLimit = maxSize || config.image?.maxSize || 100000;

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

	// Base64 encoding expands raw bytes by ~1.33x (4 chars per 3 bytes). The
	// size limit applies to the encoded output, so allow the raw file up to
	// `sizeLimit * 1.33`.
	const encodedLimit = Math.ceil(sizeLimit * 1.33);

	if (stats.size > encodedLimit) {
		return JSON.stringify({
			ok: false,
			error: `File size (${stats.size} bytes) exceeds max read size (${encodedLimit} bytes).`,
		});
	}

	// Read the file and encode as base64
	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Failed to read file: ${err.message}` });
	}

	const mimeType = detectMimeType(validation.path);
	const maxDimension = config.image?.maxDimension || DEFAULT_MAX_DIMENSION;
	buffer = await constrainDimensions(buffer, mimeType, maxDimension);

	// Build the content block via sendImageImpl and return it as-is. LangChain
	// keeps an array of content blocks intact (no JSON.stringify), so the
	// ImageDispatch middleware reads the `image_url` block directly.
	const [, imageBlock] = sendImageImpl({ data: buffer.toString("base64"), mimeType, text: "" });
	return [imageBlock];
}

const ReadImageSchema = z.object({
	path: z.string().min(1).describe("Path to the image file to read"),
});

export const readImage = tool(readImageImpl, {
	name: "readImage",
	description:
		"Read an image file from disk and return its base64-encoded contents plus MIME type, " +
		"so it can be passed directly to an LLM for vision analysis. Use this tool for ANY task " +
		"requiring vision — reading a screenshot, inspecting a diagram, or sending an image to the LLM. " +
		"Do NOT use read_file for images: read_file returns raw octet-stream binary that poisons the " +
		"session and errors the inference provider. Validates the path against the sandbox allowlist " +
		"and enforces a configurable size limit (image.maxSize, default 100000 bytes) on the base64-encoded " +
		"output, so the raw file may be up to maxSize * 1.33 bytes. Images wider or taller than image.maxDimension " +
		"(default 5000 px) are downscaled, preserving aspect ratio. Uses async file system operations.",
	schema: ReadImageSchema,
});
