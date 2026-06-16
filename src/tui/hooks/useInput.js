/**
 * useInput hook — keyboard routing for the TUI.
 * Handles scroll vs history vs input based on focus state and position.
 */

import { useCallback } from "react";

/**
 * Hook for input keyboard routing.
 * @param {Object} deps - Dependencies
 * @param {Function} deps.setInputText - Set input text
 * @param {Function} deps.setHistoryIndex - Set history index
 * @param {Function} deps.setInputFocused - Set input focus
 * @param {string[]} deps.chatHistory - Chat history array
 * @param {number} deps.historyIndex - Current history index
 * @param {boolean} deps.inputFocused - Whether input is focused
 * @param {Function} deps.handleSubmit - Submit handler
 * @param {Function} deps.handleInterrupt - Interrupt handler
 * @param {Function} deps.handleQuit - Quit handler
 * @param {boolean} deps.isStreaming - Whether streaming
 * @param {Function} deps.scrollBy - Scroll by delta
 * @param {Function} deps.getViewportHeight - Get viewport height
 * @returns {Function} Keyboard input handler
 */
export function useInput(deps) {
	/**
	 * Process a single keystroke.
	 * @param {string} input - The input character
	 * @param {Object} key - Ink key info
	 */
	const handleKeystroke = useCallback(
		(input, key) => {
			const {
				setInputText,
				setHistoryIndex,
				setInputFocused,
				chatHistory,
				historyIndex,
				inputFocused,
				handleSubmit,
				handleInterrupt,
				handleQuit,
				isStreaming,
				scrollBy,
				getViewportHeight,
			} = deps;

			if (input === "\t" || key.tab) {
				setInputFocused((prev) => !prev);
				return;
			}

			if (inputFocused) {
				if (key.escape) {
					if (isStreaming) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else if (key.return && !key.shift) {
					handleSubmit(input);
				} else if (key.upArrow && chatHistory.length > 0) {
					const newIndex =
						historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
					setHistoryIndex(newIndex);
					setInputText(chatHistory[newIndex]);
				} else if (key.downArrow) {
					if (historyIndex === -1) return;
					const nextIndex = historyIndex + 1;
					if (nextIndex >= chatHistory.length) {
						setHistoryIndex(-1);
						setInputText("");
					} else {
						setHistoryIndex(nextIndex);
						setInputText(chatHistory[nextIndex]);
					}
				} else if (key.backspace && input.length > 0) {
					setInputText((prev) => prev.slice(0, -1));
				} else if (input && input !== "\r") {
					setInputText((prev) => prev + input);
				}
			} else {
				if (key.escape) {
					if (isStreaming) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else {
					if (key.upArrow) scrollBy(-1);
					if (key.downArrow) scrollBy(1);
					if (key.pageUp) scrollBy(-getViewportHeight());
					if (key.pageDown) scrollBy(getViewportHeight());
				}
			}
		},
		[deps],
	);

	return handleKeystroke;
}
