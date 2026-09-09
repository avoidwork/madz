/**
 * Text embedding module supporting local inference via transformers.js
 * and fallback to OpenAI embeddings API.
 *
 * @module vector/embedder
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OPENAI_MODEL = "text-embedding-3-small";

/**
 * Resolve the absolute path to the onnxruntime-web WASM directory.
 * The trailing slash is required — ORT concatenates wasmPaths + filename
 * directly, so without it the path would be malformed (e.g. ".../distort-wasm-simd.wasm").
 *
 * @returns {string} Absolute path to onnxruntime-web/dist/ with trailing slash
 */
function getOrtWasmDir() {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const wasmDir = join(moduleDir, "../../node_modules/onnxruntime-web/dist/");
	// Ensure trailing slash for ORT path concatenation
	return wasmDir.endsWith("/") ? wasmDir : wasmDir + "/";
}

/**
 * Redirect the CJS require cache so that `require("onnxruntime-node")`
 * resolves to `onnxruntime-web` instead. This must run BEFORE any
 * import of `@xenova/transformers`, because its bundle unconditionally
 * requires `onnxruntime-node` at import time via an eval escape hatch.
 *
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
 * Create an embedder instance with the given configuration.
 *
 * @param {object} options - Embedder options
 * @param {"local"|"openai"} [options.model="local"] - Embedding provider
 * @param {string} [options.openaiApiKey] - OpenAI API key for fallback
 * @returns {{ embed: (texts: string|string[]) => Promise<Float32Array|Float32Array[]> }}
 */
export function createEmbedder(options = {}) {
	const { model = "local", openaiApiKey } = options;

	/** @type {import("@xenova/transformers").PipelineFunction|null} */
	let localPipeline = null;
	let pipelineLoadAttempted = false;

	/**
	 * Load the local transformers.js pipeline lazily.
	 *
	 * Two-part setup required on Alpine/musl:
	 *   Part A — Redirect the CJS require cache so the bundle's
	 *            unconditional `require("onnxruntime-node")` resolves
	 *            to onnxruntime-web (WASM) instead of the native binding.
	 *   Part B — Configure the WASM backend (wasmPaths, numThreads, proxy)
	 *            before calling pipeline().
	 *
	 * @returns {Promise<import("@xenova/transformers").PipelineFunction|null>}
	 */
	async function getLocalPipeline() {
		if (localPipeline) return localPipeline;
		if (pipelineLoadAttempted) return null;

		pipelineLoadAttempted = true;
		try {
			// Part A: Redirect native binding to WASM before transformers import
			redirectOnnxRuntime();

			// Part B: Import transformers and configure WASM backend
			const { env, pipeline } = await import("@xenova/transformers");
			env.backends.onnx.wasm.wasmPaths = getOrtWasmDir();
			env.backends.onnx.wasm.numThreads = 1;
			env.backends.onnx.wasm.proxy = false;

			localPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
				quantized: true,
			});
			return localPipeline;
		} catch (_err) {
			return null;
		}
	}

	/**
	 * Embed text using the local transformers.js pipeline.
	 * @param {string[]} texts - Array of text strings to embed
	 * @returns {Promise<Float32Array[]>}
	 */
	async function embedLocal(texts) {
		const pipe = await getLocalPipeline();
		if (!pipe) {
			throw new Error("Local embedding pipeline not available");
		}

		const results = [];
		for (const text of texts) {
			const output = await pipe(text, { pooling: "mean", normalize: true });
			results.push(new Float32Array(output.data));
		}
		return results;
	}

	/**
	 * Embed text using OpenAI embeddings API.
	 * @param {string[]} texts - Array of text strings to embed
	 * @returns {Promise<Float32Array[]>}
	 */
	async function embedOpenAI(texts) {
		if (!openaiApiKey) {
			throw new Error("OpenAI API key not configured for fallback embedding");
		}

		const response = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${openaiApiKey}`,
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				input: texts,
				dimensions: 384,
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "");
			throw new Error(`OpenAI embedding API error: ${response.status} ${errorBody}`);
		}

		const data = await response.json();
		// Sort by index to maintain input order
		data.data.sort((a, b) => a.index - b.index);

		return data.data.map((item) => new Float32Array(item.embedding));
	}

	/**
	 * Embed one or more text strings into vectors.
	 *
	 * @param {string|string[]} texts - Single text string or array of texts
	 * @returns {Promise<Float32Array|Float32Array[]>} Single embedding or array of embeddings
	 */
	async function embed(texts) {
		const inputArray = Array.isArray(texts) ? texts : [texts];
		const isSingle = !Array.isArray(texts);

		let results;
		if (model === "local") {
			try {
				results = await embedLocal(inputArray);
			} catch (localErr) {
				// Fallback to OpenAI if local fails
				try {
					results = await embedOpenAI(inputArray);
				} catch (_fallbackErr) {
					throw new Error(`Embedding failed: local (${localErr.message}), fallback also failed`);
				}
			}
		} else {
			results = await embedOpenAI(inputArray);
		}

		return isSingle ? results[0] : results;
	}

	return { embed };
}
