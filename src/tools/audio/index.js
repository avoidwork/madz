import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { extname, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import { validatePath, checkFileLimit } from "../common.js";

// Supported audio extensions for the local Whisper path.
const AUDIO_EXTENSIONS = new Set([
	".mp3",
	".wav",
	".m4a",
	".ogg",
	".flac",
	".aac",
	".webm",
	".mp4",
	".mpeg",
	".mpga",
]);

const WHISPER_MODEL = "Xenova/whisper-tiny.en";

/**
 * Resolve the absolute path to the onnxruntime-web WASM directory.
 * The trailing slash is required — ORT concatenates wasmPaths + filename
 * directly, so without it the path would be malformed.
 * @returns {string} Absolute path to onnxruntime-web/dist/ with trailing slash
 */
function getOrtWasmDir() {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const wasmDir = join(moduleDir, "../../../node_modules/onnxruntime-web/dist/");
	return wasmDir.endsWith("/") ? wasmDir : wasmDir + "/";
}

/**
 * Redirect the CJS require cache so that `require("onnxruntime-node")`
 * resolves to `onnxruntime-web` instead. This must run BEFORE any
 * import of `@xenova/transformers`, because its bundle unconditionally
 * requires `onnxruntime-node` at import time via an eval escape hatch.
 * On Alpine/musl the native binding crashes with ERR_DLOPEN_FAILED;
 * redirecting to the WASM build avoids that entirely.
 */
function redirectOnnxRuntime() {
	const require = createRequire(import.meta.url);
	const web = require("onnxruntime-web");
	const nodeMain = require.resolve("onnxruntime-node");
	require.cache[nodeMain] = {
		id: nodeMain,
		filename: nodeMain,
		loaded: true,
		exports: web,
	};
}

/**
 * Call the OpenAI audio/transcriptions endpoint.
 * @param {string} apiKey - OpenAI API key
 * @param {string} filePath - Absolute path to the audio file
 * @param {string} [language] - Optional language hint
 * @param {string} [prompt] - Optional context prompt
 * @returns {Promise<{ ok: boolean, text?: string, error?: string }>}
 */
async function callTranscribeApi(apiKey, filePath, language, prompt) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 60000);
	try {
		const form = new FormData();
		const buffer = await readFile(filePath);
		const filename = filePath.split("/").pop() || "audio.mp3";
		form.append("file", new Blob([buffer]), filename);
		form.append("model", "whisper-1");
		if (language) form.append("language", language);
		if (prompt) form.append("prompt", prompt);

		const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			body: form,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return {
				ok: false,
				error: `OpenAI transcription error (${resp.status}): ${text.slice(0, 200)}`,
			};
		}

		const data = await resp.json();
		return { ok: true, text: data.text };
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Transcription request failed: ${err.message}` };
	}
}

/**
 * Load the local Whisper pipeline via @xenova/transformers.
 * @returns {Promise<import("@xenova/transformers").PipelineFunction>}
 */
async function loadWhisperPipeline() {
	redirectOnnxRuntime();
	const { env, pipeline } = await import("@xenova/transformers");
	env.backends.onnx.wasm.wasmPaths = getOrtWasmDir();
	env.backends.onnx.wasm.numThreads = 1;
	env.backends.onnx.wasm.proxy = false;

	return pipeline("automatic-speech-recognition", WHISPER_MODEL, {
		quantized: true,
	});
}

/**
 * Transcribe audio using the local Whisper pipeline via @xenova/transformers.
 * @param {string} filePath - Absolute path to the audio file
 * @param {string} [language] - Optional language hint
 * @param {string} [prompt] - Optional context prompt
 * @param {object} [options] - Runtime options for test injection
 * @param {() => Promise<Function>} [options.loadPipeline] - Injectable pipeline loader
 * @returns {Promise<{ ok: boolean, text?: string, error?: string }>}
 */
async function transcribeLocal(filePath, language, prompt, options = {}) {
	try {
		const loadPipeline = options.loadPipeline || loadWhisperPipeline;
		const transcriber = await loadPipeline();

		const opts = {};
		if (language) opts.language = language;
		if (prompt) opts.prompt = prompt;

		const result = await transcriber(filePath, opts);
		return { ok: true, text: result.text };
	} catch (err) {
		return { ok: false, error: `Local transcription failed: ${err.message}` };
	}
}

/**
 * Transcribe an audio file to text.
 * @param {z.infer<typeof TranscribeAudioSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @returns {Promise<string>} JSON result string
 */
export async function transcribeAudioImpl(input, options = {}) {
	const { path: filePath, language, prompt } = input;

	if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Path is required and must be a non-empty string" });
	}

	const config = loadConfig();
	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	// Validate the path against the sandbox allowlist
	const validation = validatePath(filePath, allowedPaths);
	if (!validation.allowed) {
		return JSON.stringify({ ok: false, error: validation.error });
	}

	// Check the file exists
	try {
		await stat(validation.path);
	} catch (_err) {
		return JSON.stringify({ ok: false, error: `File not found: ${filePath}` });
	}

	// Enforce the size limit
	const maxReadSize = config.tools?.audio?.maxSize || "25mb";
	const sizeCheck = await checkFileLimit(validation.path, maxReadSize);
	if (!sizeCheck.ok) {
		return JSON.stringify({ ok: false, error: sizeCheck.error });
	}

	// Reject unsupported extensions
	const ext = extname(validation.path).toLowerCase();
	if (!AUDIO_EXTENSIONS.has(ext)) {
		return JSON.stringify({
			ok: false,
			error: `Unsupported audio format: "${ext}". Use one of: ${[...AUDIO_EXTENSIONS].join(", ")}`,
		});
	}

	const providers = config.providers || {};
	const providersOpenAI = providers?.openai || {};
	const credentials = providersOpenAI?.credentials || {};
	// An explicit options.openaiApiKey (even empty string) overrides config,
	// so tests can force the local path by passing an empty string.
	const apiKey = options.openaiApiKey !== undefined ? options.openaiApiKey : credentials?.apiKey;

	if (apiKey) {
		const result = await callTranscribeApi(apiKey, validation.path, language, prompt);
		if (!result.ok) {
			return JSON.stringify({ ok: false, error: result.error });
		}
		return JSON.stringify({ ok: true, text: result.text, model: "whisper-1", backend: "api" });
	}

	const result = await transcribeLocal(validation.path, language, prompt, options);
	if (!result.ok) {
		return JSON.stringify({ ok: false, error: result.error });
	}
	return JSON.stringify({ ok: true, text: result.text, model: WHISPER_MODEL, backend: "local" });
}

/**
 * @param {z.infer<typeof TranscribeAudioSchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
 */
export const transcribeAudio = tool(transcribeAudioImpl, {
	name: "transcribeAudio",
	description:
		"Transcribe an audio file to text. Uses the OpenAI audio/transcriptions endpoint when OPENAI_API_KEY is set, otherwise falls back to a local Whisper model. Returns a JSON string with the transcribed text.",
	schema: z.object({
		path: z.string().min(1).describe("Path to the audio file to transcribe"),
		language: z.string().optional().describe("Optional language hint (e.g. 'en')"),
		prompt: z.string().optional().describe("Optional context prompt to guide transcription"),
	}),
});
