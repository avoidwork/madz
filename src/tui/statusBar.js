import React from "react";
import { Box, Text } from "ink";

/**
 * Get connection status indicator and color based on status message.
 * @param {string} status
 * @returns {{ indicator: string, color: string }}
 */
function getStatusIndicator(status) {
	if (status.startsWith("Error")) {
		return { indicator: "\u2716", color: "red" }; // X
	}
	if (status === "Sending...") {
		return { indicator: "\u25B6", color: "yellow" }; // >
	}
	return { indicator: "\u25CF", color: "green" }; // filled circle
}

/**
 * Bottom status bar / input panel.
 * Displays status indicator | input cursor | skills/msg count.
 */
export function StatusBar({
	inputText = "",
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
}) {
	const isCommand = inputText && inputText.startsWith(":");
	const status = getStatusIndicator(statusMessage);

	return React.createElement(
		Box,
		{ flexDirection: "row", alignItems: "center", paddingX: 1 },
		// Connection status indicator
		React.createElement(
			Text,
			{ key: "status-indicator", color: status.color, bold: true },
			status.indicator + " ",
		),
		// Input text with cursor
		React.createElement(
			Box,
			{ key: "input", flexDirection: "row" },
			React.createElement(Text, { key: "text", color: isCommand ? "magenta" : "green" }, inputText),
			React.createElement(
				Text,
				{ key: "cursor", color: isCommand ? "magenta" : "green" },
				"\u2502",
			),
		),
		// Status message
		React.createElement(Text, { key: "status-msg", dim: true }, " " + statusMessage),
		// Separators
		React.createElement(Text, { key: "sep" }, " | "),
		// Info
		React.createElement(
			Text,
			{ key: "info", dim: true },
			"skills:" + skillCount + " msg:" + messageCount + "\u2500",
		),
	);
}
