/**
 * Virtualized message list component for conversation panel.
 * Only renders visible lines to improve rendering performance.
 */

/**
 * @typedef {Object} Message
 * @property {string} role - "user" | "assistant" | "system"
 * @property {string} content - The message content
 * @property {string} [timestamp] - ISO timestamp
 */

/**
 * Get the display label for a message role.
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
	switch (role) {
		case "user":
			return "You";
		case "assistant":
			return "Assistant";
		case "system":
			return "System";
		default:
			return role || "Unknown";
	}
}

/**
 * Calculate how many messages fit in the visible viewport.
 * @param {number} totalLines - Total available lines in the terminal
 * @param {number} linesPerMessage - Average lines per message
 * @returns {number} Maximum visible messages
 */
export function calcVisibleCount(totalLines, linesPerMessage = 3) {
	return Math.max(1, Math.floor(totalLines / linesPerMessage));
}

/**
 * Get the visible window of messages for virtualized rendering.
 * @param {Array<Message>} messages - Full conversation history
 * @param {number} scrollOffset - Current scroll position
 * @param {number} visibleCount - Number of messages that fit in viewport
 * @returns {{ messages: Array<Message>, scrollTop: number, scrollHeight: number }}
 */
export function getVisibleMessages(messages, scrollOffset, visibleCount) {
	const total = messages.length;
	const start = Math.max(0, Math.min(scrollOffset, total - visibleCount));
	const end = Math.min(total, start + visibleCount);
	const visible = messages.slice(start, end);

	return {
		messages: visible,
		scrollTop: start,
		scrollHeight: total,
		bottomReached: visibleCount >= total,
	};
}

/**
 * Format a message for IRC-style display.
 * @param {Message} message
 * @returns {string}
 */
export function formatMessage(message) {
	const label = getRoleLabel(message.role);
	return `${label}: ${(message.content || "").trim()}`;
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
