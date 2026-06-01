import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export const BANNER_ART = `
                    .___
  _____ _____     __| _/_______
 /     \\\\__  \\   / __ |\\___   /
|  Y Y  \\/ __ \\_/ /_/ | /    /
|__|_|  (____  /\\____ |/_____ \\
      \\/     \\/      \\/      \\/

`.split("\n");

const COMMAND_GROUPS = [
	{
		group: "Chat:",
		items: ["Type naturally to chat", "Up/Down arrow: message history", "Esc: quit"],
	},
	{
		group: "Command:",
		items: [
			":help - show this list",
			":provider [set <name>] - list or switch provider",
			":memory open|search <q> - open or search memory",
			":schedule [list|pause|resume|run-now]",
			":config set <path> <value> - update config",
			":context add <text> - add context",
			":quit - exit the app",
		],
	},
];

const SEPARATOR = "─".repeat(70);

/**
 * BBS-style startup banner with ASCII art and command help menu.
 * Fixed top-left alignment. Dismisses on any key press.
 * @param {Object} props
 * @param {() => void} props.onDismiss - callback to dismiss the banner
 * @param {boolean} [props.highContrast] - High-contrast display mode
 */
export function Banner({ onDismiss, highContrast = false }) {
	const [dismissed, setDismissed] = useState(false);

	useInput((input, key) => {
		if (dismissed) return;
		if (key.escape) {
			setDismissed(true);
			onDismiss();
		} else if (input && input !== "\r" && !key.upArrow && !key.downArrow) {
			setDismissed(true);
			onDismiss();
		}
	});

	const lines = BANNER_ART.filter((l) => l.trim());
	const bodyLines = COMMAND_GROUPS.flatMap((g) => [g.group, ...g.items.map((it) => "  " + it)]);

	const separatorColor = highContrast ? "white" : "gray";
	const separatorProps = highContrast ? { color: "white", bold: true } : { color: "white" };

	const children = lines.map((line, i) =>
		React.createElement(Text, { key: "art-" + i, color: "cyan" }, line),
	);

	children.push(
		React.createElement(
			Box,
			{ flexDirection: "column", marginTop: 2 },
			React.createElement(Text, separatorProps, SEPARATOR),
			...bodyLines.map((line, i) =>
				React.createElement(Text, { key: "cmd-" + i, color: "white" }, line),
			),
			React.createElement(Text, { color: separatorColor, bold: highContrast }, SEPARATOR),
			React.createElement(
				Text,
				{ color: separatorColor, bold: highContrast },
				"Press any key to continue...",
			),
		),
	);

	return React.createElement(Box, { flexDirection: "column" }, ...children);
}
