import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { COMMAND_GROUPS } from "./commandHelp.js";

export const BANNER_ART = `
                    .___
  _____ _____     __| _/_______
 /     \\\\__  \\   / __ |\\___   /
|  Y Y  \\/ __ \\_/ /_/ | /    /
|__|_|  (____  /\\____ |/_____ \\
      \\/     \\/      \\/      \\/

`.split("\n");

const SEPARATOR = "─".repeat(70);

/**
 * BBS-style startup banner with ASCII art and command help menu.
 * Fixed top-left alignment. Dismisses on any key press.
 * @param {Object} props
 * @param {() => void} props.onDismiss - callback to dismiss the banner
 * @param {string} [props.version] - optional version string to display below ASCII art
 */
export function Banner({ onDismiss, version }) {
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

	const children = lines.map((line, i) =>
		React.createElement(Text, { key: "art-" + i, color: "cyan" }, line),
	);

	if (version) {
		children.push(React.createElement(Text, { key: "version" }, version));
	}

	children.push(
		React.createElement(
			Box,
			{ flexDirection: "column", marginTop: 2 },
			React.createElement(Text, { color: "white" }, SEPARATOR),
			...bodyLines.map((line, i) =>
				React.createElement(Text, { key: "cmd-" + i, color: "white" }, line),
			),
			React.createElement(Text, { color: "gray" }, SEPARATOR),
			React.createElement(Text, { color: "gray" }, "Press any key to continue..."),
		),
	);

	return React.createElement(Box, { flexDirection: "column" }, ...children);
}
