import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DEFAULT_TIMEOUT = 30000;

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
 * Generate an image via the configured image API.
 * @param {object} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {Promise<string>} JSON result string
 */
export async function imageGenerateImpl(input, options) {
	const { prompt, timeout } = input;

	if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
		return JSON.stringify({
			ok: false,
			error: "Prompt is required and must be a non-empty string",
		});
	}

	if (prompt.length > 1000) {
		return JSON.stringify({ ok: false, error: "Prompt must be 1000 characters or fewer" });
	}

	const apiKey = options?.falApiKey;
	if (!apiKey) {
		return JSON.stringify({
			ok: false,
			error: "FAL_API_KEY is required for image generation, or pass falApiKey parameter",
		});
	}

	const timeouts = [timeout || DEFAULT_TIMEOUT];
	for (const attempt of timeouts) {
		const result = await generateWithFal(apiKey, prompt, attempt);
		if (result.ok) {
			return JSON.stringify({ ok: true, imageUrl: result.imageUrl });
		}
		// Retry on failure
		if (attempt === timeouts[timeouts.length - 1]) {
			return JSON.stringify({ ok: false, error: result.error });
		}
	}

	// node:coverage ignore next
	return JSON.stringify({ ok: false, error: "Image generation failed after retries" });
}

/**
 * @param {z.infer<typeof ImageSchema>} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const image_generate = tool(imageGenerateImpl, {
	name: "image_generate",
	description:
		"Generate an image from a text prompt using FAL.ai (FLUX Klein model). Returns a public image URL. Requires FAL_API_KEY environment variable",
	schema: z.object({
		prompt: z.string().min(1).max(1000).describe("Text description of the image to generate"),
		falApiKey: z.string().optional().describe("FAL.ai API key"),
		timeout: z
			.number()
			.int()
			.min(5000)
			.max(60000)
			.optional()
			.describe("Request timeout in ms (default: 30000)"),
	}),
});