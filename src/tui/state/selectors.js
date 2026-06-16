/**
 * Derived state selectors for the TUI.
 * Computes display values from raw state without mutating state.
 */

/**
 * Format context size as human-readable string.
 * @param {number} tokens - Raw token count
 * @returns {string} Human-readable size (e.g., "1.2k", "15k")
 */
export function formatContextSize(tokens) {
	if (tokens >= 1000000) {
		return `${(tokens / 1000000).toFixed(1)}M`;
	}
	if (tokens >= 1000) {
		return `${(tokens / 1000).toFixed(1)}k`;
	}
	return String(tokens);
}

/**
 * Compute the status message based on current state.
 * @param {Object} state - Current TUIState
 * @returns {string} Display status message
 */
export function computeStatusMessage(state) {
	if (state.isCompacting) return "Compacting context...";
	if (state.isStreaming) return "Streaming...";
	if (state.isAutoContinuing) return "Continuing...";
	return state.statusMessage || "Ready";
}

/**
 * Compute toggle indicator string for the status bar.
 * @param {Object} toggles - Current toggle state
 * @returns {string} Formatted indicator (e.g., "[ts:1 scroll:1]")
 */
export function computeToggleIndicators(toggles) {
	const parts = [];
	if (toggles.timestamps === false) parts.push("ts:0");
	if (toggles.autoScroll === false) parts.push("scroll:0");
	if (toggles.timestamps === true) parts.push("ts:1");
	if (toggles.autoScroll === true) parts.push("scroll:1");
	if (parts.length === 0) return "";
	return ` [${parts.join(" ")}]`;
}

/**
 * Get the number of non-empty messages (for status bar count).
 * @param {Array} messages - Current messages array
 * @returns {number} Message count
 */
export function computeMessageCount(messages) {
	return messages.length;
}

/**
 * Check if there is a streaming message at the end.
 * @param {Array} messages - Current messages array
 * @returns {boolean} True if last message is streaming
 */
export function hasStreamingMessage(messages) {
	if (messages.length === 0) return false;
	const last = messages[messages.length - 1];
	return last?.role === "assistant" && last?.streaming === true;
}

/**
 * Get the current scroll behavior based on state.
 * @param {Object} state - Current TUIState
 * @returns {boolean} True if auto-scroll should be active
 */
export function shouldAutoScroll(state) {
	return state.toggles.autoScroll && !state.isCompacting;
}
