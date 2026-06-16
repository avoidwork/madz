/**
 * Input hook for TUI.
 * Routes keyboard input between scroll, history navigation, and input fields.
 */
import { useCallback } from "react";

/**
 * Hook that manages keyboard input routing for the TUI.
 * Determines whether to handle input as scroll, history navigation,
 * or text input based on focus state and current context.
 *
 * @param {Object} options
 * @param {boolean} options.inputFocused - Whether the input field has focus
 * @param {string} options.inputText - Current input text
 * @param {Function} options.setInputText - Setter for input text
 * @param {string[]} options.chatHistory - Chat history array
 * @param {number} options.historyIndex - Current history index (-1 = none)
 * @param {Function} options.setHistoryIndex - Setter for history index
 * @param {Function} options.handleSubmit - Submit handler for input
 * @param {Function} options.handleInterrupt - Interrupt handler for streaming
 * @param {Function} options.handleQuit - Quit handler
 * @param {boolean} options.isStreaming - Whether currently streaming
 * @param {Function} options.setInputFocused - Setter for input focus
 * @param {Function} options.scrollUp - Scroll up handler
 * @param {Function} options.scrollDown - Scroll down handler
 * @param {Function} options.pageUp - Page up handler
 * @param {Function} options.pageDown - Page down handler
 * @returns {Function} Input handler suitable for use with ink's useInput
 */
export function useInput(options) {
	const {
		inputFocused,
		inputText,
		setInputText,
		chatHistory,
		historyIndex,
		setHistoryIndex,
		handleSubmit,
		handleInterrupt,
		handleQuit,
		isStreaming,
		setInputFocused,
		scrollUp,
		scrollDown,
		pageUp,
		pageDown,
	} = options;

	/**
	 * Handle a single keystroke.
	 * @param {string} input - The input character
	 * @param {Object} key - Key details from ink
	 * @param {boolean} [key.return] - Whether Enter was pressed
	 * @param {boolean} [key.shift] - Whether Shift was held
	 * @param {boolean} [key.escape] - Whether Escape was pressed
	 * @param {boolean} [key.upArrow] - Whether Up arrow was pressed
	 * @param {boolean} [key.downArrow] - Whether Down arrow was pressed
	 * @param {boolean} [key.backspace] - Whether Backspace was pressed
	 * @param {boolean} [key.tab] - Whether Tab was pressed
	 * @param {boolean} [key.pageUp] - Whether PageUp was pressed
	 * @param {boolean} [key.pageDown] - Whether PageDown was pressed
	 */
	const handleKeystroke = useCallback(
		(input, key) => {
			// Tab toggles focus
			if (input === "\t" || key.tab) {
				setInputFocused((prev) => !prev);
				return;
			}

			if (inputFocused) {
				// ── Input field is focused ──────────────────────────────

				if (key.escape) {
					if (isStreaming) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else if (key.return && !key.shift) {
					handleSubmit(inputText);
				} else if (key.upArrow && chatHistory.length > 0) {
					const newIndex =
						historyIndex === -1
							? chatHistory.length - 1
							: Math.max(0, historyIndex - 1);
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
				} else if (key.backspace && inputText.length > 0) {
					setInputText((prev) => prev.slice(0, -1));
				} else if (input && input !== "\r") {
					setInputText((prev) => prev + input);
				}
			} else {
				// ── Input field is NOT focused (scroll mode) ────────────

				if (key.escape) {
					if (isStreaming) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else {
					if (key.upArrow) scrollUp();
					if (key.downArrow) scrollDown();
					if (key.pageUp) pageUp();
					if (key.pageDown) pageDown();
				}
			}
		},
		[
			inputFocused,
			inputText,
			setInputText,
			chatHistory,
			historyIndex,
			setHistoryIndex,
			handleSubmit,
			handleInterrupt,
			handleQuit,
			isStreaming,
			setInputFocused,
			scrollUp,
			scrollDown,
			pageUp,
			pageDown,
		],
	);

	return handleKeystroke;
}
