import React, { useEffect } from "react";
import { Text, useCursor } from "ink";
import stringWidth from "string-width";

/**
 * Determine if the cursor should be visible based on the cursorColor prop.
 * @param {string|undefined} cursorColor - Focus state signal
 * @returns {boolean} True if cursor should be visible
 */
export function isCursorVisible(cursorColor) {
	return cursorColor !== "#202020";
}

/**
 * Calculate the cursor x-position for the given prompt and input text.
 * Uses string-width to correctly handle wide characters (CJK, emoji).
 * @param {string} prompt - The prompt prefix (e.g., "> ")
 * @param {string} inputText - The current input text
 * @returns {number} The cursor x-position (column)
 */
export function calculateCursorX(prompt, inputText) {
	return stringWidth(prompt + inputText);
}

/**
 * Input panel component using Ink's useCursor hook for proper terminal cursor positioning.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * @param {Object} props
 * @param {string} props.inputText - Current text being typed
 * @param {string} [props.cursorColor] - Focus state signal: undefined = focused (show cursor), "#202020" = unfocused (hide cursor)
 * @param {string} [props._cursorChar] - Deprecated: ignored, kept for backward compatibility
 * @returns {React.ReactElement}
 */
export function InputPanel({ inputText = "", cursorColor, _cursorChar }) {
	const { setCursorPosition } = useCursor();
	const prompt = "> ";

	useEffect(() => {
		if (isCursorVisible(cursorColor)) {
			const x = calculateCursorX(prompt, inputText);
			setCursorPosition({ x, y: 1 });
		} else {
			setCursorPosition(undefined);
		}
	}, [inputText, cursorColor, setCursorPosition]);

	return React.createElement(Text, { color: "white" }, prompt + inputText);
}
