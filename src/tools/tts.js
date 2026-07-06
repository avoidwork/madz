import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../config/loader.js";

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

/**
 * Call OpenAI TTS API to generate speech audio.
 * @param {string} apiKey - OpenAI API key
 * @param {string} text - Text to convert to speech
 * @param {string} model - TTS model name
 * @param {string} voice - Voice to use
 * @param {number} [speed=1] - Speaking speed
 * @returns {Promise<{ ok: boolean, buffer?: Buffer, error?: string }>}
 */
async function callTtsApi(apiKey, text, model, voice, speed) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 15000);
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
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @returns {Promise<string>} JSON result string
 */
export async function textToSpeechImpl(input, options = {}) {
	const { text, voice = "alloy", model = "tts-1", speed = 1 } = input;

	if (!text || typeof text !== "string" || text.trim().length === 0) {
		return JSON.stringify({
			ok: false,
			error: "Text is required and must be a non-empty string",
		});
	}

	if (text.length > 4096) {
		return JSON.stringify({
			ok: false,
			error: "Text must be 4096 characters or fewer",
		});
	}

	const config = loadConfig();
	const providers = config.providers || {};
	const providersOpenAI = providers?.openai || {};
	const credentials = providersOpenAI?.credentials || {};
	const apiKey = options.openaiApiKey || credentials?.apiKey;
	if (!apiKey) {
		return JSON.stringify({
			ok: false,
			error: "OPENAI_API_KEY is required for text-to-speech",
		});
	}

	if (!TTS_MODELS.includes(model)) {
		return JSON.stringify({
			ok: false,
			error: `Invalid model: "${model}". Use one of: ${TTS_MODELS.join(", ")}`,
		});
	}

	if (!TTS_VOICES.includes(voice)) {
		return JSON.stringify({
			ok: false,
			error: `Invalid voice: "${voice}". Use one of: ${TTS_VOICES.join(", ")}`,
		});
	}

	const result = await callTtsApi(apiKey, text, model, voice, speed);

	if (!result.ok) {
		return JSON.stringify({ ok: false, error: result.error });
	}

	// Save to ~/voice-memos/
	const memosDir = join(homedir(), "voice-memos");
	await mkdir(memosDir, { recursive: true });
	const timestamp = Date.now();
	const filename = `${timestamp}_${voice}.mp3`;
	const filePath = join(memosDir, filename);
	await writeFile(filePath, result.buffer);

	return JSON.stringify({
		ok: true,
		path: `MEDIA:${filePath}`,
		model,
		voice,
	});
}

/**
 * @param {z.infer<typeof TtsSchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
 */
export const textToSpeech = tool(textToSpeechImpl, {
	name: "textToSpeech",
	description:
		"Convert text to speech using OpenAI TTS (tts-1). Saves audio as MP3 to ~/voice-memos/[timestamp]_[voice].mp3 and returns a MEDIA: path. Requires OPENAI_API_KEY environment variable.",
	schema: z.object({
		text: z.string().min(1).max(4096).describe("Text to convert to speech"),
		voice: z
			.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"])
			.default("alloy")
			.describe("Voice to use for speech synthesis"),
		model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1").describe("TTS model (default: tts-1)"),
		speed: z.number().min(0.25).max(4).default(1).describe("Speaking speed (0.25-4.0)"),
	}),
});
