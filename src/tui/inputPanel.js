import React from "react";
import { Box, Text } from "ink";

/**
 * Display-only input panel with IRC-style prompt.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * Props:
 *   inputText - current text being typed (for display)
 */
export function InputPanel({ inputText = "" }) {
	const isCommand = inputText.startsWith(":");
	const color = isCommand ? "magenta" : "green";
	const prompt = isCommand ? ":" : ">";

	const elements = [
		React.createElement(Text, { key: "prompt", color: color }, prompt + " "),
		React.createElement(Text, { key: "input", flexGrow: 1 }, inputText || ""),
	];

	return React.createElement(Box, { flexDirection: "row" }, ...elements);
}
