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
		if (result === "NaN" || result === "-NaN") {
			return String(num);
		}
		return result;
	} catch {
		return String(num);
	}
}

/**
 * Convert a raw number to a human-readable abbreviated form (e.g., "12.2k", "1.4M").
 * @param {number} num - Number to convert
 * @returns {string} Human-readable string representation
 */
export function formatSize(bytes) {
	if (bytes === 0) return "0";
	if (bytes < 1024) return String(bytes);
	const units = ["k", "M"];
	const exp = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / Math.pow(1024, exp);
	const locale = Intl.DateTimeFormat().resolvedOptions().locale;
	const formatted =
		value % 1 === 0
			? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))
			: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
	return formatted + units[exp - 1];
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
			React.createElement(Text, { key: "status-msg", color: "#606060" }, statusMessage),
			React.createElement(Text, { key: "sep", color: "#606060" }, " |"),
			React.createElement(
				Text,
				{ key: "skills", color: "#606060" },
				" [\u26A1" + formatNumber(skillCount) + "] ",
			),
			React.createElement(
				Text,
				{ key: "messages", color: "#606060" },
				"[\u{1F4AC} " + formatNumber(messageCount) + "] ",
			),
			React.createElement(
				Text,
				{ key: "context", color: contextColor },
				"[\u25A4 " + formatSize(contextSize) + "]",
			),
		),
	);
});
