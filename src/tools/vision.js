import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

const analysisPrompt =
	"Describe this image in detail. Include what is visible, any text present, the overall context, and notable features.";

/**
 * Decode a base64 data URI into raw bytes.
 * @param {string} dataUri - Data URI string (e.g., "data:image/png;base64,...")
 * @returns {string} Base64 string without the prefix
 */
export function decodeDataUri(dataUri) {
	const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) return null;
	return match[2];
}

/**
 * Convert an ArrayBuffer to base64.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const chunkSize = 8192;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

/**
 * Fetch an image from a URL and return base64-encoded data.
 * @param {string} url - Image URL
 * @returns {Promise<{ ok: boolean, base64?: string, mimeType?: string, error?: string }>}
 */
async function fetchImageFromUrl(url) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const resp = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (!resp.ok) {
			return { ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` };
		}

		const blob = await resp.blob();
		const size = blob.size;
		if (size > MAX_IMAGE_SIZE) {
			return {
				ok: false,
				error: `Image exceeds ${MAX_IMAGE_SIZE / (1024 * 1024)}MB limit (${(size / (1024 * 1024)).toFixed(1)}MB)`,
			};
		}

		const arrayBuffer = await blob.arrayBuffer();
		return {
			ok: true,
			base64: arrayBufferToBase64(arrayBuffer),
			mimeType: blob.type || "image/jpeg",
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Image fetch failed: ${err.message}` };
	}
}

/**
 * Analyze an image by sending it to the configured multimodal LLM.
 * @param {object} input - Tool input with url or dataUri
 * @param {object} options - Runtime options
 * @returns {Promise<string>} JSON result string
 */
export async function visionAnalyzeImpl(input, options) {
	const { url, dataUri, prompt: _prompt } = input;

	if (!url && !dataUri) {
		return JSON.stringify({ ok: false, error: "Either url or dataUri is required" });
	}

	const apiKey = options?.openaiApiKey;
	if (!apiKey) {
		return JSON.stringify({
			ok: false,
			error: "OPENAI_API_KEY is required for vision analysis",
		});
	}

	let base64, mimeType;

	if (url) {
		const result = await fetchImageFromUrl(url);
		if (!result.ok) {
			return JSON.stringify({ ok: false, error: result.error });
		}
		base64 = result.base64;
		mimeType = result.mimeType;
	} else if (dataUri) {
		const decoded = decodeDataUri(dataUri);
		if (!decoded) {
			return JSON.stringify({
				ok: false,
				error: "Invalid data URI format. Expected: data:image/xxx;base64,...",
			});
		}
		// Estimate size from base64 length
		const estimatedBytes = Math.floor(decoded.length * 0.75);
		if (estimatedBytes > MAX_IMAGE_SIZE) {
			return JSON.stringify({
				ok: false,
				error: `Image exceeds ${MAX_IMAGE_SIZE / (1024 * 1024)}MB limit`,
			});
		}
		base64 = decoded;
		mimeType = dataUri.split(";")[0].split(":")[1] || "image/jpeg";
	}

	const model = new ChatOpenAI({
		model: "gpt-4o",
		configuration: { apiKey },
		maxTokens: 1024,
		temperature: 0.2,
	});

	try {
		const response = await model.invoke([
			{
				role: "user",
				content: [
					{ type: "text", text: analysisPrompt },
					{
						type: "image_url",
						image_url: { url: `data:${mimeType};base64,${base64}` },
					},
				],
			},
		]);

		// node:coverage ignore next
		const text = response.content;
		return JSON.stringify({
			ok: true,
			analysis: typeof text === "string" ? text : JSON.stringify(text),
			source: url || "dataUri",
		});
	} catch (err) {
		return JSON.stringify({ ok: false, error: `LLM analysis failed: ${err.message}` });
	}
}

/**
 * @param {z.infer<typeof VisionSchema>} input - Tool input with url or dataUri
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const vision_analyze = tool(visionAnalyzeImpl, {
	name: "visionAnalyze",
	description:
		"Analyze an image by sending it to a multimodal LLM. Accepts a URL or base64 data URI. The image is fetched, validated (max 4MB), and sent to GPT-4o for description or answering a specific question about the image.",
	schema: z.object({
		url: z.string().url().optional().describe("URL of the image to analyze"),
		dataUri: z.string().optional().describe("Base64 data URI (data:image/png;base64,...)"),
		prompt: z
			.string()
			.optional()
			.describe("Question or instruction about the image (default: describe the image)"),
	}),
});