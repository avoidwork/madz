import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";

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
 * Generate an image via the configured image API. The FAL API key is resolved
 * server-side from config/env and injected into the tool's runtime options, so
 * the secret never passes through the model's context or the transcript.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.falApiKey] - FAL.ai API key (overrides config)
 * @returns {Promise<{ ok: boolean, imageUrl?: string, error?: string }>} Structured result
 */
export async function generateImageImpl(input, options = {}) {
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

	const config = loadConfig();
	const apiKey = options.falApiKey ?? config.providers?.fal?.credentials?.apiKey;
	if (!apiKey) {
		return {
			ok: false,
			error: "FAL_API_KEY is required for image generation",
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
 * First-class image generation tool. Sends a text prompt to a remote service
 * (FAL.ai FLUX Klein) and returns a public image URL. Requires `network:outbound`
 * permission and the FAL API key (resolved server-side from config/env).
 */
export const generateImage = tool(generateImageImpl, {
	name: "generateImage",
	description:
		"Generate an image from a text prompt using FAL.ai (FLUX Klein model). Returns a public image URL. Requires network:outbound permission and the FAL API key (resolved server-side from config/env; the model never supplies it).",
	schema: z.object({
		prompt: z.string().min(1).max(1000).describe("Text description of the image to generate"),
		timeout: z
			.number()
			.int()
			.min(5000)
			.max(60000)
			.optional()
			.describe("Request timeout in ms (default: 30000)"),
	}),
});
