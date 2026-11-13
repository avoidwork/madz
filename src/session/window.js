/**
 * Normalise a window size: non-finite or < 1 values keep at least 1 item.
 * @param {number} size - Requested window size
 * @returns {number} Integer >= 1
 */
export function normalizeWindowSize(size) {
	return Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 1;
}

/**
 * Enforce the conversation context window by trimming oldest exchanges.
 * @param {Array} conversation - Full conversation history
 * @param {number} windowSize - Maximum number of exchanges to keep (min 1)
 * @returns {{ pruned: number, context: Array, history: Array }}
 */
export function enforceContextWindow(conversation, windowSize) {
	if (!conversation || conversation.length === 0) {
		return { pruned: 0, context: [], history: [] };
	}

	const window = normalizeWindowSize(windowSize);

	if (conversation.length <= window) {
		return { pruned: 0, context: [...conversation], history: [...conversation] };
	}

	const pruned = conversation.length - window;
	const context = conversation.slice(pruned);
	const history = [...conversation];

	return { pruned, context, history };
}

/**
 * Trim conversation to the latest N exchanges (N is at least 1).
 * @param {number} maxExchanges - Maximum exchanges to keep
 * @returns {Function} A function that takes and returns a conversation array
 */
export function trimConversation(maxExchanges) {
	const max = normalizeWindowSize(maxExchanges);
	return function (conversation) {
		if (!conversation || conversation.length <= max) {
			return conversation || [];
		}
		return conversation.slice(-max);
	};
}
