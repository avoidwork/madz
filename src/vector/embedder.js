/**
 * Text embedding module supporting local inference via transformers.js
 * and (opt-in) fallback to the OpenAI embeddings API.
 *
 * @module vector/embedder
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { debug, warn } from "./fileFilters.js";

const OPENAI_MODEL = "text-embedding-3-small";
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/embeddings";
export const EMBEDDING_DIM = 384;
const OPENAI_BATCH_SIZE = 64;
const LOCAL_BATCH_SIZE = 16;
const MAX_CHUNK_CHARS = 8000;
const MAX_RETRIES = 4;
const FETCH_TIMEOUT_MS = 30000;
const MAX_ERROR_BODY = 300;

/**
 * Resolve the absolute path to the onnxruntime-web WASM directory.
 * The trailing slash is required — ORT concatenates wasmPaths + filename.
 *
 * @returns {string} Absolute path to onnxruntime-web/dist/ with trailing slash
 */
function getOrtWasmDir() {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const wasmDir = join(moduleDir, "../../node_modules/onnxruntime-web/dist/");
	return wasmDir.endsWith("/") ? wasmDir : wasmDir + "/";
}

let onnxRedirected = false;

/**
 * Redirect the CJS require cache so that `require("onnxruntime-node")`
 * resolves to `onnxruntime-web` instead. Runs once per process.
 */
function redirectOnnxRuntime() {
	if (onnxRedirected) return;
	const require = createRequire(import.meta.url);
	const web = require("onnxruntime-web");
	const nodeMain = require.resolve("onnxruntime-node");
	require.cache[nodeMain] = {
		id: nodeMain,
		filename: nodeMain,
		loaded: true,
		exports: web,
	};
	onnxRedirected = true;
}

/**
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate that an embedding has the expected dimension.
 * @param {ArrayLike<number>} vec - Embedding
 * @param {string} source - Label for error messages
 * @returns {Float32Array}
 */
function checkDim(vec, source) {
	if (!vec || vec.length !== EMBEDDING_DIM) {
		throw new Error(
			`${source} returned embedding of length ${vec?.length}, expected ${EMBEDDING_DIM}`,
		);
	}
	return vec instanceof Float32Array ? vec : new Float32Array(vec);
}

/**
 * Create an embedder instance with the given configuration.
 *
 * @param {object} options - Embedder options
 * @param {"local"|"openai"} [options.model="local"] - Embedding provider
 * @param {string} [options.openaiApiKey] - OpenAI API key
 * @param {"openai"|null} [options.fallback] - Opt-in fallback provider when local fails
 *   (default: none — code is never sent to a remote service unless requested)
 * @param {string} [options.baseURL] - Override OpenAI embeddings endpoint (must be https)
 * @returns {{ embed: (texts: string|string[]) => Promise<Float32Array|Float32Array[]> }}
 */
export function createEmbedder(options = {}) {
	const { model = "local", openaiApiKey, fallback = null, baseURL } = options;

	let endpoint = DEFAULT_OPENAI_URL;
	if (baseURL !== undefined && baseURL !== null) {
		let parsed;
		try {
			parsed = new URL(baseURL);
		} catch (err) {
			throw new Error(`Invalid embedder baseURL: ${baseURL}`, { cause: err });
		}
		if (parsed.protocol !== "https:") {
			throw new Error("Embedder baseURL must use https");
		}
		endpoint = parsed.toString();
	}

	/** @type {Promise<Function>|null} */
	let pipelinePromise = null;

	/**
	 * Load the local transformers.js pipeline lazily; the load promise is
	 * cached and cleared on failure so a later call can retry.
	 * @returns {Promise<Function>}
	 */
	function getLocalPipeline() {
		pipelinePromise ??= (async () => {
			redirectOnnxRuntime();
			const { env, pipeline } = await import("@xenova/transformers");
			env.backends.onnx.wasm.wasmPaths = getOrtWasmDir();
			env.backends.onnx.wasm.numThreads = 1;
			env.backends.onnx.wasm.proxy = false;
			return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
		})().catch((err) => {
			pipelinePromise = null;
			debug(`local pipeline load failed: ${err?.message}`);
			throw new Error("Local embedding pipeline not available", { cause: err });
		});
		return pipelinePromise;
	}

	/**
	 * @param {string[]} texts - Texts to embed
	 * @returns {Promise<Float32Array[]>}
	 */
	async function embedLocal(texts) {
		const pipe = await getLocalPipeline();
		const results = [];
		for (let i = 0; i < texts.length; i += LOCAL_BATCH_SIZE) {
			const batch = texts.slice(i, i + LOCAL_BATCH_SIZE);
			const output = await pipe(batch, { pooling: "mean", normalize: true });
			const data = output.data;
			if (data.length !== batch.length * EMBEDDING_DIM) {
				throw new Error(
					`Local pipeline returned ${data.length} values for ${batch.length} texts, expected ${batch.length * EMBEDDING_DIM}`,
				);
			}
			for (let j = 0; j < batch.length; j++) {
				results.push(new Float32Array(data.slice(j * EMBEDDING_DIM, (j + 1) * EMBEDDING_DIM)));
			}
		}
		return results;
	}

	/**
	 * Send a single batch to OpenAI with retry/backoff on 429/5xx.
	 * @param {string[]} batch - Texts
	 * @returns {Promise<Float32Array[]>}
	 */
	async function openAIBatch(batch) {
		let lastErr;
		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			if (attempt > 0) {
				await sleep(Math.min(250 * 2 ** (attempt - 1), 8000));
			}
			let response;
			try {
				response = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${openaiApiKey}`,
					},
					body: JSON.stringify({
						model: OPENAI_MODEL,
						input: batch,
						dimensions: EMBEDDING_DIM,
					}),
					signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				});
			} catch (err) {
				lastErr = new Error(`OpenAI embedding request failed: ${err.message}`, { cause: err });
				continue;
			}

			if (!response.ok) {
				const body = (await response.text().catch(() => "")).slice(0, MAX_ERROR_BODY);
				const err = new Error(`OpenAI embedding API error: ${response.status} ${body}`);
				if (response.status === 429 || response.status >= 500) {
					lastErr = err;
					continue;
				}
				throw err;
			}

			const data = await response.json();
			if (!data || !Array.isArray(data.data) || data.data.length !== batch.length) {
				throw new Error(
					`OpenAI embedding response malformed: expected ${batch.length} items, got ${Array.isArray(data?.data) ? data.data.length : "no data array"}`,
				);
			}
			const sorted = [...data.data].sort((a, b) => a.index - b.index);
			return sorted.map((item) => checkDim(item.embedding, "OpenAI"));
		}
		throw lastErr;
	}

	/**
	 * @param {string[]} texts - Texts to embed
	 * @returns {Promise<Float32Array[]>}
	 */
	async function embedOpenAI(texts) {
		if (!openaiApiKey) {
			throw new Error("OpenAI API key not configured for OpenAI embedding");
		}
		const capped = texts.map((t) => (t.length > MAX_CHUNK_CHARS ? t.slice(0, MAX_CHUNK_CHARS) : t));
		const results = [];
		for (let i = 0; i < capped.length; i += OPENAI_BATCH_SIZE) {
			results.push(...(await openAIBatch(capped.slice(i, i + OPENAI_BATCH_SIZE))));
		}
		return results;
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
				if (fallback !== "openai") {
					throw new Error(`Embedding failed: local (${localErr.message})`, { cause: localErr });
				}
				warn(
					`local embedding failed (${localErr.message}); falling back to OpenAI — text is sent to a remote API`,
				);
				try {
					results = await embedOpenAI(inputArray);
				} catch (fallbackErr) {
					throw new Error(
						`Embedding failed: local (${localErr.message}), fallback also failed (${fallbackErr.message})`,
						{ cause: fallbackErr },
					);
				}
			}
		} else {
			results = await embedOpenAI(inputArray);
		}

		return isSingle ? results[0] : results;
	}

	return { embed };
}
