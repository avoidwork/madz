/**
 * Text embedding module supporting local inference via transformers.js
 * and fallback to OpenAI embeddings API.
 *
 * @module vector/embedder
 */

const OPENAI_MODEL = "text-embedding-3-small";

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
	 * @returns {Promise<import("@xenova/transformers").PipelineFunction|null>}
	 */
	async function getLocalPipeline() {
		if (localPipeline) return localPipeline;
		if (pipelineLoadAttempted) return null;

		pipelineLoadAttempted = true;
		try {
			const { pipeline } = await import("@xenova/transformers");
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
