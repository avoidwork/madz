/**
 * Message utilities for the TUI.
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
 * Check if a message is currently streaming.
 * @param {Object} message
 * @returns {boolean}
 */
export function isStreamingMessage(message) {
	return message.streaming === true;
}

/**
 * Format a message for display.
 * @param {Object} message
 * @param {string} [assistantName]
 * @returns {string}
 */
export function formatMessage(message, assistantName) {
	const label = getRoleLabel(message.role, assistantName);
	const timestamp = message.timestamp ? ` (${message.timestamp})` : "";
	return `${label}${timestamp}\n${message.content || "(empty)"}`;
}

/**
 * Count total lines needed for all messages.
 * @param {Array} messages
 * @param {number} lineWidth
 * @returns {number}
 */
export function countMessageLines(messages, lineWidth = 80) {
	let total = 0;
	for (const msg of messages) {
		total += 2;
		const lines = Math.ceil((msg.content || "").length / lineWidth);
		total += Math.max(1, lines);
		total += 1;
	}
	return total;
}

/**
 * Get tool call display lines.
 * @param {string} toolCallDisplay
 * @returns {Array<string>}
 */
export function getToolCallLines(toolCallDisplay) {
	if (!toolCallDisplay) return [];
	return toolCallDisplay.split("\n");
}
