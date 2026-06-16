/**
 * useInput hook — manages keyboard routing for the TUI.
 * Handles scroll vs history vs input focus toggle.
 */

import { useInput } from 'ink';

/**
 * Hook that manages keyboard input routing.
 * @param {Object} options
 * @param {boolean} options.showOnboarding - Whether onboarding is active
 * @param {Function} options.processOnboardingInput - Onboarding input handler
 * @param {boolean} options.showBanner - Whether banner is showing
 * @param {Function} options.setShowBanner - Banner visibility setter
 * @param {Function} options.handleQuit - Quit handler
 * @param {Function} options.handleSubmit - Submit handler
 * @param {string} options.inputText - Current input text
 * @param {Function} options.setInputText - Input text setter
 * @param {boolean} options.inputFocused - Whether input is focused
 * @param {Function} options.setInputFocused - Input focus setter
 * @param {Array} options.chatHistory - Command history
 * @param {number} options.historyIndex - Current history index
 * @param {Function} options.setHistoryIndex - History index setter
 * @param {Function} options.scrollUp - Scroll up action
 * @param {Function} options.scrollDown - Scroll down action
 * @param {Function} options.pageUp - Page up action
 * @param {Function} options.pageDown - Page down action
 * @param {boolean} options.isStreaming - Whether streaming is active
 * @param {Function} options.handleInterrupt - Interrupt handler
 * @returns {Function} useInput handler registration
 */
export function useInputRouting({
	showOnboarding,
	processOnboardingInput,
	showBanner,
	setShowBanner,
	handleQuit,
	handleSubmit,
	inputText,
	setInputText,
	inputFocused,
	setInputFocused,
	chatHistory,
	historyIndex,
	setHistoryIndex,
	scrollUp,
	scrollDown,
	pageUp,
	pageDown,
	isStreaming,
	handleInterrupt,
}) {
	return useInput((input, key) => {
		// Onboarding phase takes priority
		if (showOnboarding) {
			if (key.return && !key.shift) {
				processOnboardingInput(inputText);
				setInputText('');
			} else if (key.escape) {
				handleQuit();
			} else if (input && input !== '\r') {
				setInputText((prev) => prev + input);
			} else if (key.backspace && inputText.length > 0) {
				setInputText((prev) => prev.slice(0, -1));
			}
			return;
		}

		// Banner phase
		if (showBanner) {
			if (key.escape) {
				handleQuit();
				return;
			}
			setShowBanner(false);
			// Fall through to normal input processing
		}

		// Tab toggles input focus
		if (input === '\t' || key.tab) {
			setInputFocused((prev) => !prev);
			return;
		}

		if (inputFocused) {
			// Input is focused
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
					historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
				setHistoryIndex(newIndex);
				setInputText(chatHistory[newIndex]);
			} else if (key.downArrow) {
				if (historyIndex === -1) return;
				const nextIndex = historyIndex + 1;
				if (nextIndex >= chatHistory.length) {
					setHistoryIndex(-1);
					setInputText('');
				} else {
					setHistoryIndex(nextIndex);
					setInputText(chatHistory[nextIndex]);
				}
			} else if (key.backspace && inputText.length > 0) {
				setInputText((prev) => prev.slice(0, -1));
			} else if (input && input !== '\r') {
				setInputText((prev) => prev + input);
			}
		} else {
			// Input is not focused — scroll output
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
	});
}
