/**
 * State management hooks for TUI panels.
 */

/**
 * Panel state for rendering.
 * @param {string} [initialPanel]
 * @returns {{ activePanel: string, inputText: string, messages: string[], skills: string[], memoryEntries: string[], configSections: string[], scrollOffset: number, visibleCount: number, history: string[], historyIndex: number, isInputFocused: boolean }}
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
