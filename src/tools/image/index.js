import { tool } from "@langchain/core/tools";
import { z } from "zod";
import sharp from "sharp";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { validatePath } from "../common.js";

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

// Supported output formats for the convert action. `jpg` is intentionally
// omitted — it is an alias of `jpeg`, so listing both would be redundant.
const CONVERT_FORMAT_LIST = ["png", "jpeg", "webp", "gif", "avif", "tiff", "bmp"];
const CONVERT_FORMATS = new Set(CONVERT_FORMAT_LIST);

// Upper bound on width/height for the resize action. A request for an
// unbounded dimension is a memory problem waiting to happen.
const MAX_DIMENSION = 16384;

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
 * Read an image file from disk and return its base64-encoded contents.
 * Validates the path against the sandbox allowlist. Images larger than the
 * configured `image.maxDimension` are downscaled (the config value always
 * governs the read action; there is no per-call `maxDimension` input for
 * `read`). Uses async `node:fs/promises`.
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
 * @returns {Promise<{ ok: true, metadata: { width?: number, height?: number, format?: string, ... } }|{ ok: false, error: string }>}
 *   On success, `metadata` is sharp's metadata object (width, height, format,
 *   space, channels, density, etc.). On failure, `{ ok: false, error }`.
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
 * Dispatch the `image` tool on its `action` field.
 * @param {z.infer<typeof imageSchema>} input - Tool input
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
		default:
			return { ok: false, error: `Unknown image action: ${input.action}` };
	}
}

/**
 * Zod schema for the `image` tool input.
 *
 * A single flat object with an `action` enum so the serialized JSON schema is
 * a plain object rather than a top-level `oneOf`. Per-action field validity is
 * enforced in `superRefine` against the action's own requirements. This keeps
 * every provider (including GitHub Copilot, which rejects top-level `oneOf`
 * tool schemas) happy.
 *
 * The `image` tool is local and offline (read/resize/metadata/convert). Image
 * generation lives in the separate `generateImage` tool, which carries the
 * `network:outbound` permission and the FAL API key.
 */
export const imageSchema = z
	.object({
		action: z
			.enum(["read", "resize", "metadata", "convert"])
			.describe("The image operation to perform"),
		path: z.string().optional().describe("Path to the source image file"),
		output: z.string().optional().describe("Path to write the output image"),
		width: z
			.number()
			.int()
			.positive()
			.max(MAX_DIMENSION)
			.optional()
			.describe(`Target width in pixels (max ${MAX_DIMENSION})`),
		height: z
			.number()
			.int()
			.positive()
			.max(MAX_DIMENSION)
			.optional()
			.describe(`Target height in pixels (max ${MAX_DIMENSION})`),
		maxDimension: z
			.number()
			.int()
			.positive()
			.max(MAX_DIMENSION)
			.optional()
			.describe(`Max width/height in pixels (max ${MAX_DIMENSION})`),
		format: z
			.enum(CONVERT_FORMAT_LIST)
			.optional()
			.describe("Target format for conversion (png, jpeg, webp, gif, avif, tiff, bmp)"),
	})
	.superRefine((data, ctx) => {
		const { action } = data;
		// Reject fields that only apply to a different action, so the schema
		// makes it explicit which parameters belong to which action.
		const rejectField = (field, allowedActions) => {
			if (data[field] !== undefined && !allowedActions.includes(action)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [field],
					message: `'${field}' is only valid for the '${allowedActions.join("' or '")}' action`,
				});
			}
		};
		rejectField("output", ["resize", "convert"]);
		rejectField("width", ["resize"]);
		rejectField("height", ["resize"]);
		rejectField("maxDimension", ["resize"]);
		rejectField("format", ["convert"]);

		if (action === "read" || action === "metadata") {
			if (!data.path) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["path"],
					message: `path is required for the '${action}' action`,
				});
			}
		} else if (action === "resize") {
			if (!data.path) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["path"],
					message: "path is required for the 'resize' action",
				});
			}
			if (!data.output) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["output"],
					message: "output is required for the 'resize' action",
				});
			}
			if (!data.width && !data.height && !data.maxDimension) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["width"],
					message: "a width, height, or maxDimension is required for the 'resize' action",
				});
			}
			// maxDimension is the "fit inside" constraint and takes precedence
			// over an explicit width/height; reject the ambiguous combination.
			if (
				data.maxDimension !== undefined &&
				(data.width !== undefined || data.height !== undefined)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["maxDimension"],
					message: "maxDimension cannot be combined with width or height",
				});
			}
		} else if (action === "convert") {
			if (!data.path) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["path"],
					message: "path is required for the 'convert' action",
				});
			}
			if (!data.output) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["output"],
					message: "output is required for the 'convert' action",
				});
			}
			if (!data.format) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["format"],
					message: "format is required for the 'convert' action",
				});
			}
		}
	});

export const image = tool(imageImpl, {
	name: "image",
	description:
		"Local image tool. Dispatches on an `action` enum: `read` (read an image from disk and return a base64 data-URI image_url content block for LLM vision analysis, downscaling to the configured image.maxDimension), `resize` (resize to a target width/height or max dimension preserving aspect ratio), `metadata` (return image metadata via sharp), and `convert` (convert to another format). All actions are local and offline; they validate the path against the sandbox allowlist. For image generation from a text prompt, use the separate `generateImage` tool.",
	schema: imageSchema,
});
