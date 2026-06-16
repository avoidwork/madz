/**
 * InputPanel — display-only input with IRC-style prompt.
 * Cursor visibility is managed by useCursor in app.js.
 */
import React from "react";
import { Box, Text } from "ink";

/**
 * Display-only input panel.
 * @param {Object} props
 * @param {string} props.inputText - Current text being typed
 * @param {string} props.cursorChar - Character to use as cursor indicator
 * @param {string} [props.cursorColor] - Color for the cursor
 */
export function InputPanel({ inputText = "", cursorChar = "\u2588", cursorColor }) {
	const cursorStr = inputText + cursorChar;
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
