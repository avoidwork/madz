import React from "react";
import { Box, Text } from "ink";

/**
 * Bottom status bar / input panel.
 * Displays: cursor | input | | status | skills | messages
 */
export function StatusBar({
	inputText = "",
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
}) {
	const isCommand = inputText && inputText.startsWith(":");

	return React.createElement(
		Box,
		{ flexDirection: "row", alignItems: "center", paddingX: 1 },
		// Cursor indicator
		React.createElement(Text, { key: "cursor", color: "bold" }, "\u2514\u2500 "),
		// Input text with cursor
		React.createElement(
			Box,
			{ key: "input", flexDirection: "row" },
			React.createElement(Text, { key: "text", color: isCommand ? "magenta" : "green" }, inputText),
			React.createElement(Text, { key: "pipe", color: "green" }, "\u2502"),
		),
		// Status message
		React.createElement(Text, { key: "status", color: "dim" }, " " + statusMessage),
		// Info lines
		React.createElement(
			Box,
			{ key: "info", flexDirection: "column" },
			React.createElement(
				Text,
				{ key: "info-skills", color: "dim", size: { width: 1 } },
				"skills:" + skillCount + " msg:" + messageCount,
			),
			React.createElement(
				Text,
				{ key: "info-keys", color: "dim", size: { width: 1 } },
				"\u2191\u2193 history | \u2191\u2193 scroll | esc quit",
			),
		),
	);
}
