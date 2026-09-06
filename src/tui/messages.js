/**
 * @typedef {Object} Message
 * @property {string} role - "user" | "assistant" | "system"
 * @property {string} content - The message content
 * @property {string} [reasoningContent] - Thinking/thought content for assistant messages
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
