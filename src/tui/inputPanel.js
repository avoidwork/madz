import React from "react";
import { Box, Text } from "ink";

/**
 * Input cursor component. Renders text with an inline cursor character
 * so that wrapping behaves correctly — the cursor moves with the text
 * instead of staying pinned to the end of line 1.
 * @param {Object} props
 * @param {string} props.text - Input text to render
 * @param {string} props.char - Cursor character
 * @param {string} [props.cursorColor] - Cursor text color (defaults to white)
 * @returns {React.ReactElement}
 */
export function Blink({ text = "", char = "\u2588", cursorColor }) {
	const cursorStr = text + char;
	return React.createElement(
		Box,
		{ flexDirection: "row" },
		React.createElement(
			Text,
			{ key: "cursor", color: cursorColor || "white" },
			cursorStr,
		),
	);
}

/**
 * Display-only input panel with IRC-style prompt and blinking cursor.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * @param {Object} props
 * @param {string} props.inputText - Current text being typed
 * @param {string} props.cursorChar - Character to use as cursor indicator
 * @param {string} [props.cursorColor] - Color for the cursor
 */
export function InputPanel({ inputText = "", cursorChar = "\u2588", cursorColor }) {
	if (cursorColor) {
		return React.createElement(Blink, { text: inputText, char: cursorChar, cursorColor });
	}
	return React.createElement(Blink, { text: inputText, char: cursorChar });
}
