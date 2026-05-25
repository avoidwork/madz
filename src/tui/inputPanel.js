import React from "react";
import { Box, Text } from "ink";

/**
 * Display-only input panel with IRC-style prompt.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * Props:
 *   inputText - current text being typed (for display)
 *   appInfo - { name, version } app identity for right-side display
 */
export function InputPanel({ inputText = "", appInfo }) {
	const isCommand = inputText.startsWith(":");
	const color = isCommand ? "magenta" : "green";
	const prompt = isCommand ? ":" : ">";

	const elements = [
		React.createElement(Text, { key: "prompt", color: color }, prompt + " "),
		React.createElement(Text, { key: "input", flexGrow: 1 }, inputText || ""),
	];

	if (appInfo) {
		const space = appInfo.name ? " " : "";
		elements.push(
			React.createElement(Text, { key: "space-left", dim: appInfo.version }, space || " "),
		);
		if (appInfo.name) {
			elements.push(React.createElement(Text, { key: "app-name", color: "cyan" }, appInfo.name));
			elements.push(React.createElement(Text, { key: "space-right" }, " "));
		}
		if (appInfo.version) {
			elements.push(
				React.createElement(Text, { key: "app-version", color: "white" }, appInfo.version),
			);
		}
	}

	return React.createElement(Box, { flexDirection: "row" }, ...elements);
}
