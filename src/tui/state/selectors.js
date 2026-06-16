/**
 * Derived state selectors for TUI state.
 * Extracted from app.js to provide computed values without duplicating logic.
 */

/**
 * Get a human-readable status message based on current state.
 * Combines statusMessage with compacting/streaming indicators.
 * @param {Object} state - TUIState
 * @returns {string} Formatted status message
 */
export function getStatusMessage(state) {
	const { statusMessage, isCompacting, isStreaming } = state;

	if (isCompacting) {
		return "Compacting context...";
	}
	if (isStreaming) {
		return "Streaming...";
	}
	return statusMessage || "Ready";
}

/**
 * Format context size using human-readable units.
 * @param {number} size - Token count
 * @returns {string} Formatted size string (e.g., "12.2k", "1.4M")
 */
export function formatContextSize(size) {
	if (size === 0) return "0";
	if (size < 1024) return String(size);
	const units = ["k", "M"];
	const exp = Math.floor(Math.log(size) / Math.log(1024));
	const value = size / Math.pow(1024, exp);
	const locale = Intl.DateTimeFormat().resolvedOptions().locale;
	const formatted =
		value % 1 === 0
			? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))
			: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
	return formatted + units[exp - 1];
}

/**
 * Get the last message in the conversation.
 * @param {Object} state - TUIState
 * @returns {Object|null} Last message or null
 */
export function getLastMessage(state) {
	const { messages } = state;
	if (!messages || messages.length === 0) return null;
	return messages[messages.length - 1];
}

/**
 * Check if there are any messages in the conversation.
 * @param {Object} state - TUIState
 * @returns {boolean}
 */
export function hasMessages(state) {
	return state.messages && state.messages.length > 0;
}

/**
 * Get the number of user messages.
 * @param {Object} state - TUIState
 * @returns {number}
 */
export function getUserMessageCount(state) {
	return state.messages.filter((m) => m.role === "user").length;
}

/**
 * Get the number of assistant messages.
 * @param {Object} state - TUIState
 * @returns {number}
 */
export function getAssistantMessageCount(state) {
	return state.messages.filter((m) => m.role === "assistant").length;
}
