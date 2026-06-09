/**
 * Handle cursor navigation and text cursor-position-aware editing.
 * @param {string} inputText - Current input text
 * @param {number} cursorPosition - Current cursor position
 * @param {Object} key - Key event info (key.leftArrow, key.rightArrow, key.backspace)
 * @param {string} character - Character typed (for insertion)
 * @returns {{inputText: string, cursorPosition: number}}
 */
export function handleTextInput(inputText, cursorPosition, key, character) {
	if (key.rightArrow && cursorPosition < inputText.length) {
		return { inputText, cursorPosition: cursorPosition + 1 };
	}
	if (key.leftArrow && cursorPosition > 0) {
		return { inputText, cursorPosition: cursorPosition - 1 };
	}
	if (key.backspace && inputText.length > 0) {
		if (cursorPosition > 0) {
			return {
				inputText: inputText.slice(0, cursorPosition - 1) + inputText.slice(cursorPosition),
				cursorPosition: cursorPosition - 1,
			};
		}
		return { inputText, cursorPosition };
	}
	if (character && character !== "\r" && character !== "\n") {
		return {
			inputText: inputText.slice(0, cursorPosition) + character + inputText.slice(cursorPosition),
			cursorPosition: cursorPosition + 1,
		};
	}
	return { inputText, cursorPosition };
}
