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

/**
 * Format a message for display.
 * @param {Message} message
 * @param {string} [assistantName] - Optional custom name for assistant role
 * @returns {string}
 */
export function formatMessage(message, assistantName) {
	const label = getRoleLabel(message.role, assistantName);
	const timestamp = message.timestamp ? ` (${message.timestamp})` : "";
	return `${label}${timestamp}\n${message.content || "(empty)"}`;
}

/**
 * Check if a message is currently streaming.
 * @param {Message} message
 * @returns {boolean}
 */
export function isStreamingMessage(message) {
	return message.streaming === true;
}

/**
 * Count total lines needed for all messages (for scroll height).
 * @param {Array<Message>} messages
 * @param {number} lineWidth - Maximum characters per line
 * @returns {number}
 */
export function countMessageLines(messages, lineWidth = 80) {
	let total = 0;
	for (const msg of messages) {
		total += 2; // Label + content start
		const lines = Math.ceil((msg.content || "").length / lineWidth);
		total += Math.max(1, lines);
		total += 1; // Separator
	}
	return total;
}

/**
 * Get tool call display lines formatted for render output.
 * @param {string} toolCallDisplay - Raw tool call display string with "\n" separators
 * @returns {Array<string>}
 */
export function getToolCallLines(toolCallDisplay) {
	if (!toolCallDisplay) return [];
	return toolCallDisplay.split("\n");
}
