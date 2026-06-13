/**
 * Calculate the total token count of a conversation using tiktoken.
 * @param {Array} conversation - Array of {role, content} messages
 * @param {string} modelName - The model name (e.g., "gpt-4o", "llama3.1")
 * @param {string} [encoding] - Optional explicit tiktoken encoder name.
 *   Resolved in order: env var → config.yaml → derived from model name.
 * @returns {number} Total token count
 */
export function calculateConversationTokens(conversation, modelName, encoding) {
	if (!conversation || conversation.length === 0) {
		return 0;
	}

	// Resolve encoder: env var takes priority, then config, then derive from model name.
	const encoderName =
		process.env.OPENAI_ENCODING ||
		encoding ||
		(modelName ? modelName.split(":")[0] : "gpt-4o");

	let tiktoken;
	try {
		tiktoken = require("tiktoken");
	} catch {
		// tiktoken not available — estimate based on character count
		// Rough heuristic: ~4 characters per token for English text
		return estimateTokensFromCharacters(conversation);
	}

	try {
		const enc = tiktoken.encoding_for_model(encoderName);
		let totalTokens = 0;

		for (const msg of conversation) {
			if (msg && msg.content) {
				const tokens = enc.encode(msg.content);
				totalTokens += tokens.length;
			}
		}

		enc.free();
		return totalTokens;
	} catch {
		// encoding_for_model failed — estimate based on character count
		return estimateTokensFromCharacters(conversation);
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
