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
 * Format number using Intl.NumberFormat with the user's locale.
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
	try {
		const locale = Intl.DateTimeFormat().resolvedOptions().locale;
		const formatter = new Intl.NumberFormat(locale, {
			maximumFractionDigits: 0,
		});
		const result = formatter.format(num);
		// Handle NaN case (non-numeric input)
		if (result === "NaN" || result === "-NaN") {
			return String(num);
		}
		return result;
	} catch {
		// Fallback to simple string conversion if Intl fails
		return String(num);
	}
}

/**
 * Bottom status bar.
 * Displays status indicator, status message, and info counts.
 * Input text entry is handled by InputPanel with IRC-style prompt ("> text" / ": text").
 */
export const StatusBar = React.memo(function StatusBar({
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
	contextSize = 0,
	isCompacting = false,
}) {
	const status = getStatusIndicator(statusMessage);
	const contextColor = isCompacting ? "red" : "#606060";

	return React.createElement(
		Box,
		{
			flexDirection: "row",
			alignItems: "center",
			width: "100%",
			paddingX: 1,
			backgroundColor: "#101010",
			justifyContent: "flex-start",
		},
		React.createElement(
			Box,
			{ key: "left", flexDirection: "row", alignItems: "center" },
			React.createElement(
				Text,
				{ key: "status-indicator", color: status.color, bold: true },
				status.indicator + " ",
			),
			React.createElement(Text, { key: "status-msg", color: "#606060" }, " " + statusMessage),
			React.createElement(Text, { key: "sep", color: "#606060" }, " | "),
			React.createElement(
				Text,
				{ key: "info", color: "#606060" },
				"skills:" + formatNumber(skillCount) + " msg:" + formatNumber(messageCount),
			),
			React.createElement(Text, { key: "context", color: contextColor }, " context:" + formatNumber(contextSize)),
		),
	);
});
