/**
 * Enforce the conversation context window by trimming oldest exchanges.
 * @param {Array} conversation - Full conversation history
 * @param {number} windowSize - Maximum number of exchanges to keep
 * @returns {{ pruned: number, context: Array, history: Array }}
 */
export function enforceContextWindow(conversation, windowSize) {
	if (!conversation || conversation.length === 0) {
		return { pruned: 0, context: [], history: [] };
	}

	const window = Math.max(1, Math.floor(windowSize));

	if (conversation.length <= window) {
		return { pruned: 0, context: [...conversation], history: [...conversation] };
	}

	const pruned = conversation.length - window;
	const context = conversation.slice(pruned);
	const history = [...conversation];

	return { pruned, context, history };
}

/**
 * Trim conversation to the latest N exchanges.
 * @param {number} maxExchanges
 * @returns {Function} A function that takes and returns a conversation array
 */
export function trimConversation(maxExchanges) {
	return function (conversation) {
		if (!conversation || conversation.length <= maxExchanges) {
			return conversation || [];
		}
		return conversation.slice(-maxExchanges);
	};
}
