/**
 * @typedef {Object} Message
 * @property {string} role - "user" | "assistant" | "system"
 * @property {string} content - The message content
 * @property {Array<{type: string, content: string}>} [segments] - Ordered content segments for interleaved rendering
 * @property {Object} [activeToolCall] - {name: string} for assistant when a tool is running
 * @property {string} [toolCallDisplay] - Tool call result strings for assistant messages
 * @property {Array<Object>} [events] - Raw stream events for this message
 * @property {string} [time] - Timestamp
 * @property {boolean} [streaming] - Whether currently streaming
 */

/**
 * Get the display label for a message role.
 * @param {string} role - Message role: "user", "assistant", or "system"
 * @param {string} [assistantName] - Optional custom name for assistant role
 * @returns {string}
 */
export function getRoleLabel(role, assistantName) {
	switch (role) {
		case "user":
			return "You";
		case "assistant":
			return assistantName || "Assistant";
		case "system":
			return "System";
		default:
			return role || "Unknown";
	}
}

/**
 * Normalize completed tool calls into a count map.
 *
 * Accepts either a legacy array of tool names (e.g. `["read_file", "read_file"]`)
 * or a count map (e.g. `{ read_file: 2 }`). Arrays are collapsed into counts so
 * old session transcripts and the live streaming path share one shape. Returns a
 * fresh object; never mutates the input.
 *
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {Object} Count map `{ [name]: count }`
 */
export function normalizeCompletedToolCalls(calls) {
	if (!calls) return {};
	if (Array.isArray(calls)) {
		const map = {};
		for (const name of calls) {
			map[name] = (map[name] || 0) + 1;
		}
		return map;
	}
	return { ...calls };
}

/**
 * Whether there are any completed tool calls to display.
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {boolean} True if at least one call is present
 */
export function hasCompletedToolCalls(calls) {
	return Object.keys(normalizeCompletedToolCalls(calls)).length > 0;
}

/**
 * Format completed tool calls for display.
 *
 * Collapses repeated calls into a `name ×count` form and hides the count for
 * tools called once. Insertion order is preserved (first-call order), so the
 * summary reads as a record of what happened rather than a ranking.
 *
 * @param {string[]|Object} [calls] - Completed tool call names or a count map
 * @returns {{total: number, text: string}} Total call count and display text
 */
export function formatCompletedToolCalls(calls) {
	const map = normalizeCompletedToolCalls(calls);
	const names = Object.keys(map);
	const total = names.reduce((sum, name) => sum + map[name], 0);
	const text = names.map((name) => (map[name] > 1 ? `${name} ×${map[name]}` : name)).join(", ");
	return { total, text };
}
