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
 * Get status indicator text label for high-contrast mode.
 * @param {string} statusMessage
 * @returns {string}
 */
export function getStatusLabel(statusMessage) {
	if (statusMessage.startsWith("Error")) {
		return "ERROR";
	}
	if (
		statusMessage === "Sending..." ||
		statusMessage === "Streaming..." ||
		statusMessage.startsWith("Sending") ||
		statusMessage.startsWith("Streaming")
	) {
		return "SEND";
	}
	return "OK";
}

/**
 * Bottom status bar.
 * Displays status indicator, status message, and info counts.
 * Input text entry is handled by InputPanel with IRC-style prompt ("> text" / ": text").
 * @param {object} props
 * @param {string} [props.statusMessage] - The current status message
 * @param {number} [props.skillCount] - Number of registered skills
 * @param {number} [props.messageCount] - Number of conversation messages
 * @param {object} [props.appInfo] - Application name and version
 * @param {boolean} [props.highContrast] - High-contrast display mode
 */
export const StatusBar = React.memo(function StatusBar({
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
	appInfo,
	highContrast = false,
}) {
	const status = getStatusIndicator(statusMessage);
	const statusLabel = highContrast ? getStatusLabel(statusMessage) : "";

	return React.createElement(
		Box,
		{
			flexDirection: "row",
			alignItems: "center",
			width: "100%",
			paddingX: 1,
			backgroundColor: "#e0e0e0",
			justifyContent: "space-between",
		},
		React.createElement(
			Box,
			{ key: "left", flexDirection: "row", alignItems: "center" },
			React.createElement(
				Text,
				{ key: "status-indicator", color: status.color, bold: true },
				status.indicator + " " + (statusLabel ? statusLabel + " " : ""),
			),
			React.createElement(
				Text,
				{
					key: "status-msg",
					dim: !highContrast,
					color: highContrast ? "white" : undefined,
					bold: highContrast,
				},
				" " + statusMessage,
			),
			React.createElement(Text, { key: "sep" }, " | "),
			React.createElement(
				Text,
				{
					key: "info",
					dim: !highContrast,
					color: highContrast ? "white" : undefined,
					bold: highContrast,
				},
				"skills:" + skillCount + " msg:" + messageCount,
			),
		),
		...(appInfo
			? [
					React.createElement(
						Text,
						{ key: "app-name", color: "white", bold: true },
						appInfo.name + " " + (appInfo.version || ""),
					),
				]
			: []),
	);
});
