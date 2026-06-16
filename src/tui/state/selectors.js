/**
 * TUI Selectors — derived state functions.
 * Computes derived values from the base state to avoid redundant state.
 */

/**
 * Compute the display status message from base state.
 * @param {Object} state - TUIState
 * @returns {string} Display status
 */
export function getStatusMessage(state) {
	if (state.isCompacting) return 'Compacting context...';
	if (state.isStreaming) return 'Streaming...';
	if (state.isAutoContinuing) return 'Continuing...';
	return state.statusMessage;
}

/**
 * Compute toggle indicator string for status bar.
 * Format: [ts:1 scroll:1] where 1=true, 0=false
 * @param {Object} toggles - Toggles object
 * @returns {string} Toggle indicator string
 */
export function getToggleIndicators(toggles) {
	const parts = [];
	if (toggles.timestamps !== undefined) {
		parts.push(`ts:${toggles.timestamps ? 1 : 0}`);
	}
	if (toggles.autoScroll !== undefined) {
		parts.push(`scroll:${toggles.autoScroll ? 1 : 0}`);
	}
	if (parts.length === 0) return '';
	return ` [${parts.join(' ')}]`;
}

/**
 * Check if the last message is streaming.
 * @param {Array} messages - Message array
 * @returns {boolean}
 */
export function hasStreamingMessage(messages) {
	if (!messages || messages.length === 0) return false;
	return messages[messages.length - 1]?.streaming === true;
}

/**
 * Get the last message (if any).
 * @param {Array} messages - Message array
 * @returns {Object|undefined}
 */
export function getLastMessage(messages) {
	if (!messages || messages.length === 0) return undefined;
	return messages[messages.length - 1];
}

/**
 * Check if user is at the bottom of the conversation.
 * @param {Object} state - TUIState
 * @returns {boolean}
 */
export function isAtBottom(state) {
	if (state.viewportHeight === 0) return true;
	return state.scrollOffset <= 0;
}
