/**
 * StatusBar — bottom status bar with metrics and toggle indicators.
 */
import React from "react";
import { Box, Text } from "ink";
import { getToggleIndicators } from "../state/selectors.js";

/**
 * Get connection status indicator and color based on status message.
 * @param {string} status
 * @returns {{ indicator: string, color: string }}
 */
function getStatusIndicator(status) {
	if (status.startsWith("Error")) {
		return { indicator: "\u2716", color: "red" };
	}
	if (status === "Sending..." || status === "Streaming..." || status === "Continuing...") {
		return { indicator: "\u25B6", color: "yellow" };
	}
	return { indicator: "\u25CF", color: "green" };
}

/**
 * Format number using Intl.NumberFormat with the user's locale.
 * @param {number} num
 * @returns {string}
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
 * Convert a raw number to a human-readable abbreviated form.
 * @param {number} bytes
 * @returns {string}
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
 * @param {Object} props
 * @param {string} props.statusMessage
 * @param {number} props.skillCount
 * @param {number} props.messageCount
 * @param {number} props.contextSize
 * @param {boolean} props.isCompacting
 * @param {Object} [props.toggles] - Runtime toggles for indicators
 */
export const StatusBar = React.memo(function StatusBar({
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
	contextSize = 0,
	isCompacting = false,
	toggles = {},
}) {
	const status = getStatusIndicator(statusMessage);
	const contextColor = isCompacting ? "red" : "#606060";
	const toggleIndicators = getToggleIndicators(toggles);

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
			toggleIndicators
				? React.createElement(Text, { key: "toggles", color: "#606060" }, toggleIndicators)
				: null,
		),
	);
});
