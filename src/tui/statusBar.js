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
	if (status === "Sending..." || status === "Streaming...") {
		return { indicator: "\u25B6", color: "yellow" }; // >
	}
	return { indicator: "\u25CF", color: "green" }; // filled circle
}

/**
 * Bottom status bar.
 * Displays status indicator, status message, and info counts.
 * Input text entry is handled by InputPanel with IRC-style prompt ("> text" / ": text").
 */
export function StatusBar({ statusMessage = "", skillCount = 0, messageCount = 0, appInfo }) {
	const status = getStatusIndicator(statusMessage);

	return React.createElement(
		Box,
		{
			flexDirection: "row",
			alignItems: "center",
			width: "100%",
			paddingX: 1,
			backgroundColor: "#404040",
			justifyContent: "space-between",
		},
		React.createElement(
			Box,
			{ key: "left", flexDirection: "row", alignItems: "center" },
			React.createElement(
				Text,
				{ key: "status-indicator", color: status.color, bold: true },
				status.indicator + " ",
			),
			React.createElement(Text, { key: "status-msg", dim: true }, " " + statusMessage),
			React.createElement(Text, { key: "sep" }, " | "),
			React.createElement(
				Text,
				{ key: "info", dim: true },
				"skills:" + skillCount + " msg:" + messageCount,
			),
		),
		...(appInfo
			? [
					React.createElement(Text, { key: "app-name", color: "cyan" }, appInfo.name),
					React.createElement(Text, { key: "pad" }, " "),
					React.createElement(Text, { key: "app-version", color: "white" }, appInfo.version || ""),
				]
			: []),
	);
}
