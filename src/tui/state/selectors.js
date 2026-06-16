/**
 * Derived state selectors for the TUI.
 * These compute values from the base state to avoid duplicating logic.
 */

import { formatSize } from "../statusBar.js";

/**
 * Get the formatted context size string for display.
 * @param {number} contextSize - Raw token count
 * @returns {string} Formatted size string (e.g., "1.2k")
 */
export function selectContextSize(contextSize) {
	return formatSize(contextSize);
}

/**
 * Get the status message for display.
 * @param {string} statusMessage - Raw status message
 * @returns {string} Status message
 */
export function selectStatusMessage(statusMessage) {
	return statusMessage || "Ready";
}

/**
 * Get the last message in the conversation.
 * @param {Array} messages - All messages
 * @returns {Object|undefined} Last message or undefined
 */
export function selectLastMessage(messages) {
	if (!messages || messages.length === 0) return undefined;
	return messages[messages.length - 1];
}

/**
 * Check if there are any streaming messages.
 * @param {Array} messages - All messages
 * @returns {boolean}
 */
export function selectHasStreamingMessage(messages) {
	if (!messages || messages.length === 0) return false;
	const last = messages[messages.length - 1];
	return last?.streaming === true;
}

/**
 * Get the toggle indicator string for the status bar.
 * @param {{autoScroll: boolean, timestamps: boolean, commandEcho: boolean, cursorBreathe: boolean, debugOutput: boolean}} toggles - Toggle states
 * @returns {string} Formatted indicator string (e.g., "[ts:1 scroll:1]")
 */
export function selectToggleIndicators(toggles) {
	const parts = [];
	if (toggles.timestamps !== undefined) parts.push(`ts:${toggles.timestamps ? 1 : 0}`);
	if (toggles.autoScroll !== undefined) parts.push(`scroll:${toggles.autoScroll ? 1 : 0}`);
	return parts.length > 0 ? `[${parts.join(" ")}]` : "";
}
