import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { loadConfig } from "../../config/loader.js";
import { validatePath } from "../common.js";

const TTS_MODELS = ["tts-1", "tts-1-hd"];
const TTS_VOICES = [
	"alloy",
	"ash",
	"ballad",
	"coral",
	"echo",
	"fable",
	"onyx",
	"nova",
	"sage",
	"shimmer",
];

const DEFAULT_TIMEOUT = 15000;

/**
 * Call OpenAI TTS API to generate speech audio.
 * @param {string} apiKey - OpenAI API key
 * @param {string} text - Text to convert to speech
 * @param {string} model - TTS model name
 * @param {string} voice - Voice to use
 * @param {number} [speed=1] - Speaking speed
 * @param {number} [timeout=15000] - Request timeout in ms
 * @returns {Promise<{ ok: boolean, buffer?: Buffer, error?: string }>}
 */
async function callTtsApi(apiKey, text, model, voice, speed, timeout = DEFAULT_TIMEOUT) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch("https://api.openai.com/v1/audio/speech", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				input: text,
				voice,
				speed: Math.min(Math.max(speed, 0.25), 4.0),
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `OpenAI TTS error (${resp.status}): ${text.slice(0, 200)}` };
		}

		const buffer = Buffer.from(await resp.arrayBuffer());
		return { ok: true, buffer };
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `TTS request failed: ${err.message}` };
	}
}

/**
 * Convert text to speech using OpenAI TTS API.
 * @param {object} input - Tool input
 * @param {string} [input.outputPath] - Output file path (defaults to config.memory.toolsDir)
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<{ ok: boolean, path?: string, model?: string, voice?: string, error?: string }>}
 */
export async function textToSpeechImpl(input, options = {}) {
	const { text, voice = "alloy", model = "tts-1", speed = 1, timeout, outputPath } = input;

	if (!text || typeof text !== "string" || text.trim().length === 0) {
		return {
			ok: false,
			error: "Text is required and must be a non-empty string",
		};
	}

	if (text.length > 4096) {
		return {
			ok: false,
			error: "Text must be 4096 characters or fewer",
		};
	}

	if (typeof speed !== "number" || !Number.isFinite(speed)) {
		return {
			ok: false,
			error: "Speed must be a finite number between 0.25 and 4.0",
		};
	}

	const config = loadConfig();
	const providers = config.providers || {};
	const providersOpenAI = providers?.openai || {};
	const credentials = providersOpenAI?.credentials || {};
	const apiKey = options.openaiApiKey || credentials?.apiKey;
	if (!apiKey) {
		return {
			ok: false,
			error: "OPENAI_API_KEY is required for text-to-speech",
		};
	}

	if (!TTS_MODELS.includes(model)) {
		return {
			ok: false,
			error: `Invalid model: "${model}". Use one of: ${TTS_MODELS.join(", ")}`,
		};
	}

	if (!TTS_VOICES.includes(voice)) {
		return {
			ok: false,
			error: `Invalid voice: "${voice}". Use one of: ${TTS_VOICES.join(", ")}`,
		};
	}

	const result = await callTtsApi(apiKey, text, model, voice, speed, timeout);

	if (!result.ok) {
		return { ok: false, error: result.error };
	}

	// Enforce the sandbox write size limit on the audio buffer
	const maxWriteSize = config.sandbox?.maxWriteSize ?? 512000;
	if (result.buffer.length > maxWriteSize) {
		return {
			ok: false,
			error: `Audio size (${result.buffer.length} bytes) exceeds maximum allowed size (${maxWriteSize} bytes).`,
		};
	}

	// Save to config.memory.toolsDir, or an explicit outputPath override
	const toolsDir = config.memory?.toolsDir || "memory/tools/";
	const timestamp = Date.now();
	const filePath = outputPath || join(config.cwd, toolsDir, `${timestamp}_${voice}.mp3`);

	// Validate the output path against the sandbox allowlist
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];
	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return { ok: false, error: validation.error };
	}

	try {
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, result.buffer);
	} catch (err) {
		return { ok: false, error: `Failed to save audio: ${err.message}` };
	}

	return {
		ok: true,
		path: `MEDIA:${filePath}`,
		model,
		voice,
	};
}

/**
 * @param {z.infer<typeof TtsSchema>} input
 * @param {object} _options - Runtime options
 * @returns {Promise<{ ok: boolean, path?: string, model?: string, voice?: string, error?: string }>}
 */
export const textToSpeech = tool(textToSpeechImpl, {
	name: "textToSpeech",
	description:
		"Convert text to speech using OpenAI TTS (tts-1). Saves audio as MP3 to memory/tools/[timestamp]_[voice].mp3 and returns a MEDIA: path. Requires OPENAI_API_KEY environment variable.",
	schema: z.object({
		text: z.string().min(1).max(4096).describe("Text to convert to speech"),
		voice: z
			.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"])
			.default("alloy")
			.describe("Voice to use for speech synthesis"),
		model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1").describe("TTS model (default: tts-1)"),
		speed: z.number().min(0.25).max(4).default(1).describe("Speaking speed (0.25-4.0)"),
		timeout: z
			.number()
			.int()
			.min(5000)
			.max(60000)
			.optional()
			.describe("Request timeout in ms (default: 15000)"),
		outputPath: z
			.string()
			.optional()
			.describe("Absolute path for the output .mp3 file (defaults to config.memory.toolsDir)"),
		openaiApiKey: z.string().optional().describe("OpenAI API key"),
	}),
});
