import React, { useEffect } from "react";
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
	const { setCursorPosition } = useCursor();

	// Position the real terminal cursor after the prompt + input text
	useEffect(() => {
		setCursorPosition(
			hasText
				? { x: stringWidth("> " + inputText) + 2, y: totalRows }
				: undefined,
		);
	}, [hasText, inputText, totalRows, setCursorPosition]);

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
