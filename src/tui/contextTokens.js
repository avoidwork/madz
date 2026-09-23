/**
 * Map of tiktoken encoding names to a model name that tiktoken recognizes.
 * Used as a fallback when an explicit encoding cannot be resolved directly
 * via `tiktoken.get_encoding`. `encoding_for_model` is keyed by model name,
 * so an encoding name must never be passed to it directly.
 */
const ENCODING_TO_MODEL = Object.freeze({
	cl100k_base: "gpt-4o",
	o200k_base: "gpt-4o",
	p50k_base: "gpt-3.5-turbo",
});

/**
 * Calculate the total token count of a conversation using tiktoken.
 * @param {Array} conversation - Array of {role, content} messages
 * @param {string} modelName - The model name (e.g., "gpt-4o", "llama3.1")
 * @param {string} [encoding] - Optional explicit tiktoken encoder name.
 *   Resolved in order: env var, config, derived from model name.
 * @returns {Promise<number>} Total token count
 */
export async function calculateConversationTokens(conversation, modelName, encoding) {
	if (!conversation || conversation.length === 0) {
		return 0;
	}

	let tiktoken;
	try {
		tiktoken = await import("tiktoken");
	} catch (_err) {
		// tiktoken not available — estimate based on character count
		// Rough heuristic: ~4 characters per token for English text
		return estimateTokensFromCharacters(conversation);
	}

	const explicitEncoding = process.env.OPENAI_ENCODING || encoding;
	const enc = resolveEncoder(tiktoken, explicitEncoding, modelName);
	if (!enc) {
		// No tiktoken encoder could be resolved — last-resort character estimate
		return estimateTokensFromCharacters(conversation);
	}

	let totalTokens = 0;
	for (const msg of conversation) {
		if (msg && msg.content) {
			const tokens = enc.encode(msg.content);
			totalTokens += tokens.length;
		}
	}
	enc.free();
	return totalTokens;
}

/**
 * Resolve a tiktoken encoder. An explicit encoding (env var or config) is
 * resolved directly via `get_encoding` (with an encoding→model fallback);
 * otherwise the model name (minus any `:version` suffix) is resolved via
 * `encoding_for_model`. Returns null when no encoder can be resolved.
 * @param {Object} tiktoken - The loaded tiktoken module
 * @param {string} [explicitEncoding] - Explicit encoding name, if configured
 * @param {string} [modelName] - The model name
 * @returns {Object|null} A tiktoken encoder, or null
 */
function resolveEncoder(tiktoken, explicitEncoding, modelName) {
	if (explicitEncoding) {
		try {
			return tiktoken.get_encoding(explicitEncoding);
		} catch (_err) {
			const fallbackModel = ENCODING_TO_MODEL[explicitEncoding];
			if (fallbackModel) {
				try {
					return tiktoken.encoding_for_model(fallbackModel);
				} catch (_innerErr) {
					return null;
				}
			}
			return null;
		}
	}
	const baseModel = modelName ? modelName.split(":")[0] : "";
	if (!baseModel) return null;
	try {
		return tiktoken.encoding_for_model(baseModel);
	} catch (_err) {
		return null;
	}
}

/**
 * Estimate token count based on character count as a fallback.
 * Uses rough heuristic: ~4 characters per token for English text.
 * @param {Array} conversation - Array of {role, content} messages
 * @returns {number} Estimated token count
 */
function estimateTokensFromCharacters(conversation) {
	let totalChars = 0;
	for (const msg of conversation) {
		if (msg && msg.content) {
			totalChars += msg.content.length;
		}
	}
	// Rough heuristic: ~4 characters per token for English text
	return Math.ceil(totalChars / 4);
}
