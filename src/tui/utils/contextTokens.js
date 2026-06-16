/**
 * Context token calculation utilities.
 */

/**
 * Calculate the total token count of a conversation using tiktoken.
 * @param {Array} conversation - Array of {role, content} messages
 * @param {string} modelName - The model name (e.g., "gpt-4o", "llama3.1")
 * @param {string} [encoding] - Optional explicit tiktoken encoder name.
 * @returns {number} Total token count
 */
export function calculateConversationTokens(conversation, modelName, encoding) {
	if (!conversation || conversation.length === 0) {
		return 0;
	}

	const encoderName =
		process.env.OPENAI_ENCODING ||
		encoding ||
		(modelName ? modelName.split(":")[0] : "gpt-4o");

	let tiktoken;
	try {
		tiktoken = require("tiktoken");
	} catch {
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
		return estimateTokensFromCharacters(conversation);
	}
}

/**
 * Estimate token count based on character count as a fallback.
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
	return Math.ceil(totalChars / 4);
}
