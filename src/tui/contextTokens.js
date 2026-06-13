/**
 * Calculate the total token count of a conversation using tiktoken.
 * @param {Array} conversation - Array of {role, content} messages
 * @param {string} modelName - The model name (e.g., "gpt-4o", "llama3.1")
 * @returns {number} Total token count
 */
export function calculateConversationTokens(conversation, modelName) {
	if (!conversation || conversation.length === 0) {
		return 0;
	}

	let tiktoken;
	try {
		tiktoken = require("tiktoken");
	} catch {
		// tiktoken not available — return message count as fallback
		return conversation.length;
	}

	const enc = tiktoken.encoding_for_model(modelName);
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
