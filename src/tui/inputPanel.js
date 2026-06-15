import React from "react";
import { Box, Text, useCursor } from "ink";
import stringWidth from "string-width";

/**
 * Display-only input panel with IRC-style prompt and real terminal cursor.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * @param {Object} props
 * @param {string} props.inputText - Current text being typed
 * @param {number} props.totalRows - Total number of rows in the Ink output
 */
export function InputPanel({ inputText = "", totalRows = 0 }) {
	const hasText = Boolean(inputText && inputText.trim());

	// Position the real terminal cursor after the prompt + input text
	useCursor(
		hasText
			? { x: stringWidth("> " + inputText), y: totalRows - 1 }
			: undefined,
	);

	return React.createElement(
		Box,
		{ flexDirection: "row" },
		React.createElement(Text, { key: "prompt", color: "white" }, ">"),
		React.createElement(
			Text,
			{ key: "text", color: "white" },
			hasText ? " " + inputText : "",
		),
	);
}
