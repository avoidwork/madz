import { tool } from "@langchain/core/tools";
import { z } from "zod";
import sharp from "sharp";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { validatePath } from "../common.js";

const DEFAULT_TIMEOUT = 30000;

// An unknown MIME type falls back to image/png so a valid data URI is always built.
const DEFAULT_MIME_TYPE = "image/png";

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

const MIME_TYPES_SET = new Set(Object.values(MIME_TYPES));

// Supported output formats for the convert action.
const CONVERT_FORMATS = new Set(["png", "jpeg", "jpg", "webp", "gif", "avif", "tiff", "bmp"]);

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
 * Generate an image via FAL.ai flux/klein API.
 * @param {string} apiKey - FAL.ai API key
 * @param {string} prompt - Image generation prompt
 * @param {number} timeout - API timeout in ms
 * @returns {Promise<{ ok: boolean, imageUrl?: string, error?: string }>}
 */
async function generateWithFal(apiKey, prompt, timeout) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const resp = await fetch("https://queue.fal.run/fal-ai/flux/klein", {
			method: "POST",
			headers: {
				Authorization: `Key ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				prompt,
				sync_mode: true,
				image_size: "square_1_1",
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `FAL.ai error (${resp.status}): ${text.slice(0, 200)}` };
		}

		const data = await resp.json();
		if (!data.images || !data.images[0]?.url) {
			return { ok: false, error: "FAL.ai response missing image URL" };
		}

		return {
			ok: true,
			imageUrl: data.images[0].url,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `FAL.ai request failed: ${err.message}` };
	}
}

/**
 * Read an image file from disk and return its base64-encoded contents.
 * Validates the path against the sandbox allowlist. Images larger than
 * `image.maxDimension` are downscaled. Uses async `node:fs/promises`.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<Array|{ ok: boolean, error: string }>} `[image_url block]` on success; an error object on failure
 */
async function readAction(input, options = {}) {
	const { path: filePath } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return { ok: false, error: "Path is required and must be a non-empty string" };
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	// Validate the path against the sandbox allowlist
	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return { ok: false, error: validation.error };
	}

	// Check the file exists
	try {
		await stat(validation.path);
	} catch (_err) {
		return { ok: false, error: `File not found: ${filePath}` };
	}

	// Read the file and encode as base64
	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return { ok: false, error: `Failed to read file: ${err.message}` };
	}

	const mimeType = detectMimeType(validation.path);
	const maxDimension = config.image.maxDimension;
	buffer = await constrainDimensions(buffer, mimeType, maxDimension);

	// Return an image content block. LangChain keeps an array of content
	// blocks intact (no JSON.stringify), so the model receives the image
	// straight from the tool message.
	const dataUriMime = MIME_TYPES_SET.has(mimeType) ? mimeType : DEFAULT_MIME_TYPE;
	return [
		{
			type: "image_url",
			image_url: { url: `data:${dataUriMime};base64,${buffer.toString("base64")}` },
		},
	];
}

/**
 * Resize an image to a target width/height (or max dimension), preserving
 * aspect ratio and never enlarging. Writes the result to the target path.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<{ ok: boolean, path?: string, error?: string }>} Structured result
 */
async function resizeAction(input, options = {}) {
	const { path: filePath, output, width, height, maxDimension } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return { ok: false, error: "Path is required and must be a non-empty string" };
	}
	if (!output || typeof output !== "string" || output.trim().length === 0) {
		return { ok: false, error: "Output path is required and must be a non-empty string" };
	}
	if (!width && !height && !maxDimension) {
		return { ok: false, error: "A width, height, or maxDimension is required" };
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return { ok: false, error: validation.error };
	}

	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return { ok: false, error: `Failed to read file: ${err.message}` };
	}

	try {
		const resizeOptions = maxDimension
			? { width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true }
			: { width, height, fit: "inside", withoutEnlargement: true };
		const resized = await sharp(buffer).resize(resizeOptions).toBuffer();
		await sharp(resized).toFile(output);
		return { ok: true, path: output };
	} catch (err) {
		return { ok: false, error: `Failed to resize image: ${err.message}` };
	}
}

/**
 * Return image metadata (width, height, format, etc.) via sharp.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<{ ok: boolean, metadata?: object, error?: string }>} Structured result
 */
async function metadataAction(input, options = {}) {
	const { path: filePath } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return { ok: false, error: "Path is required and must be a non-empty string" };
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return { ok: false, error: validation.error };
	}

	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return { ok: false, error: `Failed to read file: ${err.message}` };
	}

	try {
		const metadata = await sharp(buffer).metadata();
		return { ok: true, metadata };
	} catch (err) {
		return { ok: false, error: `Failed to read image metadata: ${err.message}` };
	}
}

/**
 * Convert an image to another format (e.g., png, jpeg, webp) and write the
 * result to the target path.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<{ ok: boolean, path?: string, error?: string }>} Structured result
 */
async function convertAction(input, options = {}) {
	const { path: filePath, output, format } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return { ok: false, error: "Path is required and must be a non-empty string" };
	}
	if (!output || typeof output !== "string" || output.trim().length === 0) {
		return { ok: false, error: "Output path is required and must be a non-empty string" };
	}
	if (!format || !CONVERT_FORMATS.has(format)) {
		return { ok: false, error: `Unsupported format: ${format}` };
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return { ok: false, error: validation.error };
	}

	let buffer;
	try {
		buffer = await readFile(validation.path);
	} catch (err) {
		return { ok: false, error: `Failed to read file: ${err.message}` };
	}

	try {
		const converted = await sharp(buffer)[format]().toBuffer();
		await sharp(converted).toFile(output);
		return { ok: true, path: output };
	} catch (err) {
		return { ok: false, error: `Failed to convert image: ${err.message}` };
	}
}

/**
 * Generate an image via the configured image API.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.falApiKey] - FAL.ai API key (overrides config)
 * @param {boolean} [options.networkOutbound] - Whether `network:outbound` permission is enabled
 * @returns {Promise<{ ok: boolean, imageUrl?: string, error?: string }>} Structured result
 */
async function generateAction(input, options = {}) {
	const { prompt, timeout } = input;

	if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
		return {
			ok: false,
			error: "Prompt is required and must be a non-empty string",
		};
	}

	if (prompt.length > 1000) {
		return { ok: false, error: "Prompt must be 1000 characters or fewer" };
	}

	if (options.networkOutbound === false) {
		return {
			ok: false,
			error: "Image generation requires the network:outbound permission",
		};
	}

	const config = loadConfig();
	const apiKey = options.falApiKey ?? config.providers?.fal?.credentials?.apiKey;
	if (!apiKey) {
		return {
			ok: false,
			error: "FAL_API_KEY is required for image generation, or pass falApiKey parameter",
		};
	}

	const timeoutMs = timeout || DEFAULT_TIMEOUT;
	const result = await generateWithFal(apiKey, prompt, timeoutMs);
	if (result.ok) {
		return { ok: true, imageUrl: result.imageUrl };
	}
	return { ok: false, error: result.error };
}

/**
 * Dispatch the `image` tool on its `action` field.
 * @param {z.infer<typeof ImageSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @returns {Promise<Array|{ ok: boolean, ... }>} Action-specific result
 */
export async function imageImpl(input, options = {}) {
	switch (input.action) {
		case "read":
			return readAction(input, options);
		case "resize":
			return resizeAction(input, options);
		case "metadata":
			return metadataAction(input, options);
		case "convert":
			return convertAction(input, options);
		case "generate":
			return generateAction(input, options);
		default:
			return { ok: false, error: `Unknown image action: ${input.action}` };
	}
}

const ImageSchema = z.object({
	action: z
		.enum(["read", "resize", "metadata", "convert", "generate"])
		.describe("The image operation to perform"),
	path: z.string().optional().describe("Path to the source image file"),
	output: z.string().optional().describe("Path to write the output image"),
	width: z.number().int().positive().optional().describe("Target width in pixels"),
	height: z.number().int().positive().optional().describe("Target height in pixels"),
	maxDimension: z.number().int().positive().optional().describe("Max width/height in pixels"),
	format: z.string().optional().describe("Target format for conversion (png, jpeg, webp, etc.)"),
	prompt: z.string().max(1000).optional().describe("Text description of the image to generate"),
	falApiKey: z.string().optional().describe("FAL.ai API key"),
	timeout: z
		.number()
		.int()
		.min(5000)
		.max(60000)
		.optional()
		.describe("Request timeout in ms (default: 30000)"),
});

export const image = tool(imageImpl, {
	name: "image",
	description:
		"Unified image tool. Dispatches on an `action` enum: `read` (read an image from disk and return a base64 data-URI image_url content block for LLM vision analysis, downscaling to image.maxDimension), `resize` (resize to a target width/height or max dimension preserving aspect ratio), `metadata` (return image metadata via sharp), `convert` (convert to another format), and `generate` (generate an image from a text prompt via FAL.ai FLUX Klein, returning a public image URL). The read action validates the path against the sandbox allowlist. The generate action requires network:outbound permission and the FAL API key.",
	schema: ImageSchema,
});
