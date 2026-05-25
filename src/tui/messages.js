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
 * Estimate additional lines added by markdown formatting (blank lines between
 * paragraphs, heading spacers, list item spacing, code block borders).
 * @param {string} content
 * @returns {number}
 */
function estimateMarkdownLines(content) {
	if (!content) return 0;
	let bonus = 0;
	const lines = content.split("\n");
	for (const line of lines) {
		if (/^\s*$/.test(line)) bonus += 1; // blank lines between blocks
		if (/^#{1,6}\s/.test(line)) bonus += 1; // heading + extra line
		if (/^(- |\d+\. )/.test(line.trim())) bonus += 0; // list items already one line
		if (line.trim().startsWith("```")) bonus += 1; // fenced code block adds a line
		if (line.trim().startsWith("---") || line.trim().startsWith("*** ")) bonus += 2; // h-rule
	}
	return Math.min(bonus, Math.floor(lines.length * 0.3));
}

/**
 * Count total lines needed for all messages (for scroll height).
 * Assistant and system messages get a markdown line-count bonus.
 * @param {Array<Message>} messages
 * @param {number} lineWidth - Maximum characters per line
 * @returns {number}
 */
export function countMessageLines(messages, lineWidth = 80) {
	let total = 0;
	for (const msg of messages) {
		total += 2; // Label + content start
		const content = msg.content || "";
		const plainLines = Math.ceil(content.length / lineWidth);
		total += Math.max(1, plainLines);
		if (msg.role === "assistant" || msg.role === "system") {
			total += estimateMarkdownLines(content);
		}
		total += 1; // Separator
	}
	return total;
}
