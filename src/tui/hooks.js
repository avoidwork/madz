/**
 * State management hooks for TUI panels.
 */

import { nextPanel as _nextPanel, prevPanel as _prevPanel } from "./panels.js";

/**
 * Panel state for rendering.
 */
export function createPanelState(initialPanel) {
	return {
		activePanel: initialPanel || "conversation",
		inputText: "",
		messages: [],
		skills: [],
		memoryEntries: [],
		configSections: [],
		scrollOffset: 0,
		visibleCount: 20,
		history: [],
		historyIndex: -1,
		isInputFocused: true,
	};
}

/**
 * Cycle to the next panel for tab navigation.
 * @param {string} current
 * @returns {string}
 */
export function nextPanel(current) {
	return _nextPanel(current);
}

/**
 * Cycle to the previous panel for Shift+Tab navigation.
 * @param {string} current
 * @returns {string}
 */
export function prevPanel(current) {
	return _prevPanel(current);
}
