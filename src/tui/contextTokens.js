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
 * Flatten a single message's content into a tokenizable text string.
 * Handles string content, content-block arrays (text, image_url, reasoning),
 * and object content (serialized to JSON). Tool calls on assistant messages
 * are appended so the estimate is not under-counted.
 * @param {Object} msg - A message (LangChain or {role, content})
 * @returns {string} The flattened text content
 */
function messageContent(msg) {
	let content = msg?.content;
	if (Array.isArray(content)) {
		content = content
			.map((block) => {
				if (typeof block === "string") return block;
				if (block?.type === "text") return block.text;
				if (block?.type === "image_url") return "[image]";
				if (block?.type === "reasoning") return block.reasoning ?? "";
				return "";
			})
			.join("");
	} else if (content && typeof content === "object") {
		content = JSON.stringify(content);
	}
	let text = content ?? "";
	if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
		const toolCallsText = JSON.stringify(msg.tool_calls);
		text = text ? `${text}\n${toolCallsText}` : toolCallsText;
	}
	return text;
}

/**
 * Calculate the total token count of a conversation using tiktoken.
 * Accepts either normalized `{role, content}` messages or raw LangChain
 * messages (with content blocks, tool calls, tool messages). Each message is
 * flattened to text exactly once, so content blocks and tool calls are not
 * double-counted.
 * @param {Array} conversation - Array of messages
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
		if (msg) {
			const text = messageContent(msg);
			if (text) {
				const tokens = enc.encode(text);
				totalTokens += tokens.length;
			}
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
 * @param {Array} conversation - Array of messages
 * @returns {number} Estimated token count
 */
function estimateTokensFromCharacters(conversation) {
	let totalChars = 0;
	for (const msg of conversation) {
		if (msg) {
			totalChars += messageContent(msg).length;
		}
	}
	// Rough heuristic: ~4 characters per token for English text
	return Math.ceil(totalChars / 4);
}
