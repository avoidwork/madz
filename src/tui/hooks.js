/**
 * State management hooks for TUI panels.
 */

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
	const order = ["conversation", "skills", "memory", "settings"];
	const idx = order.indexOf(current);
	return order[(idx + 1) % order.length];
}

/**
 * Cycle to the previous panel for Shift+Tab navigation.
 * @param {string} current
 * @returns {string}
 */
export function prevPanel(current) {
	const order = ["conversation", "skills", "memory", "settings"];
	const idx = order.indexOf(current);
	return order[(idx - 1 + order.length) % order.length];
}
