/**
 * State management hooks for TUI.
 * (Panel navigation removed — use /skills and /memory commands instead.)
 */

/**
 * Panel state for rendering.
 * Kept for backward compatibility but panel navigation is deprecated.
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
