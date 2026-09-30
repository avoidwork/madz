import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Known image MIME types. An unknown or absent MIME type defaults to image/png
// so a valid data URI is always constructed.
const IMAGE_MIME_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/bmp",
	"image/svg+xml",
	"image/avif",
	"image/tiff",
	"image/x-icon",
]);

const DEFAULT_MIME_TYPE = "image/png";

/**
 * Build a multimodal content array from base64 image data.
 * Produces `[{ type: "text", text }, { type: "image_url", image_url: { url: "data:<mimeType>;base64,<data>" } }]`.
 * Unknown or absent MIME types default to `image/png`.
 * @param {z.infer<typeof SendImageSchema>} input - Tool input
 * @param {string} input.data - Base64-encoded image bytes
 * @param {string} [input.mimeType] - Image MIME type (defaults to `image/png`)
 * @param {string} input.text - Text prompt to pair with the image
 * @returns {Array<{type: string, text?: string, image_url?: {url: string}}>} Multimodal content array
 */
export function sendImageImpl(input) {
	const { data, mimeType, text } = input;
	const resolvedMimeType = IMAGE_MIME_TYPES.has(mimeType) ? mimeType : DEFAULT_MIME_TYPE;

	return [
		{ type: "text", text },
		{ type: "image_url", image_url: { url: `data:${resolvedMimeType};base64,${data}` } },
	];
}

const SendImageSchema = z.object({
	data: z.string().min(1).describe("Base64-encoded image bytes"),
	mimeType: z.string().optional().describe("Image MIME type (defaults to image/png)"),
	text: z.string().describe("Text prompt to pair with the image"),
});

export const sendImage = tool(sendImageImpl, {
	name: "sendImage",
	description:
		"Build a multimodal content array from base64 image data and a text prompt, " +
		'producing `[{ type: "text", text }, { type: "image_url", image_url: { url: "data:<mimeType>;base64,<data>" } }]`. ' +
		"Unknown or absent MIME types default to `image/png`. This is a content-builder used by the " +
		"image-dispatch middleware to inject a `readImage` result into the LLM conversation as vision input.",
	schema: SendImageSchema,
});
