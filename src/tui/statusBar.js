import React, { useEffect, useRef } from "react";
import { Box, Text, useStdout } from "ink";

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
 * 10-frame spinner sequence (Unicode braille characters).
 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

/**
 * Bottom status bar.
 * Displays status indicator, status message, and info counts.
 * Input text entry is handled by InputPanel with IRC-style prompt ("> text" / ": text").
 *
 * Spinner animation is handled imperatively via stdout.write() with ANSI escape codes,
 * bypassing React's render cycle entirely. This prevents the spinner from triggering
 * re-renders of the StatusBar or its parent App component.
 */
export const StatusBar = React.memo(function StatusBar({
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
	contextSize = 0,
	isCompacting = false,
}) {
	const contextColor = isCompacting ? "red" : "#606060";
	const isStreaming = statusMessage === "Sending..." || statusMessage === "Streaming...";
	const { stdout } = useStdout();
	const intervalRef = useRef(null);
	const frameRef = useRef(0);

	// Imperative spinner: write frames directly to stdout, bypassing React
	useEffect(() => {
		if (!isStreaming) return;

		// Hide cursor before starting spinner
		stdout.write("\x1B[?25l");

		const tick = () => {
			const frame = SPINNER_FRAMES[frameRef.current % SPINNER_FRAMES.length];
			frameRef.current += 1;
			// \r overwrites the current line position with the spinner + trailing space
			stdout.write(`\r${frame} `);
		};

		// Initial frame
		tick();
		intervalRef.current = setInterval(tick, SPINNER_INTERVAL_MS);

		return () => {
			clearInterval(intervalRef.current);
			// Restore cursor on unmount
			stdout.write("\x1B[?25h");
		};
	}, [isStreaming, stdout]);

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
			{ key: "left", flexDirection: "row", alignItems: "center" },
			isStreaming
				? React.createElement(Text, { color: "cyan" }, " ")
				: React.createElement(Text, { color: "#606060" }, "∙∙∙"),

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
