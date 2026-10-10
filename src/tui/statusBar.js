import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { basename } from "node:path";

// Resolve the user's locale once at module load. `Intl.NumberFormat` is the
// correct formatter for numeric output; `Intl.DateTimeFormat` was used before
// but is semantically wrong for numbers and can differ from the number locale
// (e.g. a date locale vs. a number locale). Caching avoids re-resolving on
// every render.
const LOCALE = Intl.NumberFormat().resolvedOptions().locale;

/**
 * Format number using Intl.NumberFormat with the user's locale.
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
	try {
		const formatter = new Intl.NumberFormat(LOCALE, {
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
 * Convert a raw number to a human-readable abbreviated form with SI postfix (e.g., "12.2k", "1.4M").
 * @param {number} num - Number to convert
 * @returns {string} Human-readable string representation
 */
export function formatSize(num) {
	if (num === 0) return "0";
	const abs = Math.abs(num);
	const units = ["", "k", "M", "B", "T"];
	const unitIndex = Math.min(Math.floor(Math.log10(abs) / 3), units.length - 1);
	const scaled = num / Math.pow(10, unitIndex * 3);
	const formatted = new Intl.NumberFormat(LOCALE, {
		maximumFractionDigits: scaled % 1 !== 0 ? 1 : 0,
	}).format(scaled);
	return formatted + units[unitIndex];
}

/**
 * Determine the spinner color from context-window utilization.
 * 0-60% → cyan, 61-80% → orange, 81-100% → red. Falls back to cyan when no
 * context window is configured (contextWindow is 0/unset).
 * @param {number} contextSize - Current context size in tokens
 * @param {number} contextWindow - Configured context window in tokens (0 = unset)
 * @returns {string} The color name for the streaming spinner
 */
export function getContextUtilizationColor(contextSize, contextWindow) {
	if (!contextWindow || contextWindow <= 0) return "cyan";
	const utilization = (contextSize / contextWindow) * 100;
	if (utilization <= 60) return "cyan";
	if (utilization <= 80) return "orange";
	return "red";
}

/**
 * Compute the context-window utilization percentage.
 * Returns 0 when no context window is configured (contextWindow is 0/unset)
 * to avoid a divide-by-zero.
 * @param {number} contextSize - Current context size in tokens
 * @param {number} contextWindow - Configured context window in tokens (0 = unset)
 * @returns {number} Utilization percentage in the range [0, 100]
 */
export function getContextUtilization(contextSize, contextWindow) {
	if (!contextWindow || contextWindow <= 0) return 0;
	return Math.round((contextSize / contextWindow) * 100);
}

/**
 * Render a visual context-window utilization meter.
 * Produces a bar of block characters (filled `▮` / empty `▯`) plus a
 * percentage label, e.g. `[▮▮▮▯▯▯] 62%`. The bar uses a fixed number of
 * segments so it renders consistently regardless of terminal width.
 * @param {number} contextSize - Current context size in tokens
 * @param {number} contextWindow - Configured context window in tokens (0 = unset)
 * @returns {string} The rendered meter string
 */
export function renderContextMeter(contextSize, contextWindow) {
	const utilization = getContextUtilization(contextSize, contextWindow);
	const segments = 6;
	const filled = Math.round((utilization / 100) * segments);
	const bar = "▮".repeat(filled) + "▯".repeat(Math.max(0, segments - filled));
	return `[${bar}] ${utilization}%`;
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
	contextWindow = 0,
	statusBar = {},
	project = "",
}) {
	const contextColor = isCompacting ? "red" : "#606060";
	const isStreaming = statusMessage === "Sending..." || statusMessage === "Streaming...";
	const spinnerColor = getContextUtilizationColor(contextSize, contextWindow);
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
	// under a projects/ directory. `path.basename()` handles both POSIX and
	// Windows separators and strips any trailing slash.
	const projectName = project.includes("projects/") ? basename(project) : project;

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
						{ color: spinnerColor },
						React.createElement(Spinner, { type: "point" }),
					)
				: React.createElement(Text, { color: "#606060" }, "∙∙∙"),

			showModel ? React.createElement(Text, { key: "model", color: "#606060" }, " " + model) : null,

			showSkills
				? React.createElement(
						Text,
						{ key: "skills", color: "#606060" },
						" \u2219 \u26A1 " + formatNumber(skillCount),
					)
				: null,
			showMessages
				? React.createElement(
						Text,
						{ key: "messages", color: "#606060" },
						" \u2219 \u{1F4AC} " + formatNumber(messageCount),
					)
				: null,
			showContext
				? React.createElement(
						Text,
						{ key: "context", color: contextColor },
						" \u2219 " +
							(contextWindow > 0
								? renderContextMeter(contextSize, contextWindow)
								: formatSize(contextSize)),
					)
				: null,
			showTokens
				? React.createElement(
						Text,
						{ key: "tokens", color: "#606060" },
						" \u2219 \u{1F48E} " + formatSize(tokenCount) + "/" + formatSize(tokenBudget),
					)
				: null,

			showProject
				? React.createElement(Text, { key: "project", color: "#606060" }, " \u2219 " + projectName)
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
					React.createElement(
						Text,
						{ key: "version", color: "#606060", width: 10, flexShrink: 0, wrap: "truncate-end" },
						version,
					),
				)
			: null,
	);
});
