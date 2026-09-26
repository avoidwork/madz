import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

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
	} catch (_err) {
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
	const locale = Intl.DateTimeFormat().resolvedOptions().locale;
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(bytes);
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
	version = "",
	model = "",
	quote = "",
	tokenCount = 0,
	tokenBudget = 0,
	statusBar = {},
	project = "",
}) {
	const contextColor = isCompacting ? "red" : "#606060";
	const isStreaming = statusMessage === "Sending..." || statusMessage === "Streaming...";
	const showModel = statusBar.model !== false && model;
	const showSkills = statusBar.skills !== false;
	const showMessages = statusBar.messages !== false;
	const showContext = statusBar.context !== false;
	const showTokens = statusBar.tokens !== false && tokenBudget > 0;
	const showQuote = statusBar.quote !== false && quote;
	const showVersion = statusBar.version !== false && version;
	const showProject = statusBar.project !== false && project;
	// Render only the subdirectory name within projects/ (e.g., "foo" for
	// "/path/to/projects/foo"), falling back to the full path if it's not
	// under a projects/ directory.
	const projectName = project.includes("projects/")
		? project.slice(project.lastIndexOf("projects/") + "projects/".length)
		: project;

	return React.createElement(
		Box,
		{
			flexDirection: "row",
			alignItems: "center",
			width: "100%",
			paddingX: 1,
			backgroundColor: "#0d0d0d",
			justifyContent: "flex-start",
		},
		React.createElement(
			Box,
			{ key: "left", flexDirection: "row", alignItems: "center", flexShrink: 0 },
			isStreaming
				? React.createElement(
						Text,
						{ color: "cyan" },
						React.createElement(Spinner, { type: "point" }),
					)
				: React.createElement(Text, { color: "#606060" }, "∙∙∙"),

			showModel
				? React.createElement(Text, { key: "model", color: "#606060" }, " [" + model + "]")
				: null,

			showProject
				? React.createElement(Text, { key: "project", color: "#606060" }, " [" + projectName + "]")
				: null,

			showSkills
				? React.createElement(
						Text,
						{ key: "skills", color: "#606060" },
						" [\u26A1" + formatNumber(skillCount) + "] ",
					)
				: null,
			showMessages
				? React.createElement(
						Text,
						{ key: "messages", color: "#606060" },
						"[\u{1F4AC} " + formatNumber(messageCount) + "] ",
					)
				: null,
			showContext
				? React.createElement(
						Text,
						{ key: "context", color: contextColor },
						"[\u25A6 " + formatSize(contextSize) + "]",
					)
				: null,
			showTokens
				? React.createElement(
						Text,
						{ key: "tokens", color: "#606060" },
						" [\u{1F48E} " + formatNumber(tokenCount) + "/" + formatNumber(tokenBudget) + "]",
					)
				: null,
		),
		showVersion
			? React.createElement(
					Box,
					{ key: "right", marginLeft: "auto", flexShrink: 1, minWidth: 0 },
					showQuote
						? React.createElement(
								Box,
								{ key: "quote", flexShrink: 1, minWidth: 0 },
								React.createElement(Text, { color: "#606060", wrap: "truncate-end" }, quote + "  "),
							)
						: null,
					React.createElement(Text, { key: "version", color: "#606060" }, version),
				)
			: null,
	);
});
