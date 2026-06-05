// banner.js - TUI startup banner
import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";

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
			":schedule [list|pause|resume|run-now]",
			":config set <path> <value> - update config",
			":clear - clear conversation",
			":quit - exit the app",
		],
	},
];

const SEPARATOR = "─".repeat(70);

/**
 * BBS-style startup banner.
 * @param {object} props
 * @param {() => void} props.onDismiss
 */
export function Banner({ onDismiss }) {
	const [dismissed, setDismissed] = useState(false);

	useKeyboard((event) => {
		if (dismissed) return;
		const { key, input } = event;
		if (key.name === "escape") {
			setDismissed(true);
			onDismiss();
		} else if (input && input !== "\r" && key.name !== "up" && key.name !== "down") {
			setDismissed(true);
			onDismiss();
		}
	});

	const lines = BANNER_ART.filter((l) => l.trim());
	const bodyLines = COMMAND_GROUPS.flatMap((g) => [g.group, ...g.items.map((it) => "  " + it)]);

	const children = lines.map((line, i) => (
		<text key={"art-" + i} fg="#00FFFF">
			{line}
		</text>
	));

	children.push(
		<box flexDirection="column" marginTop={2}>
			<text fg="#FFFFFF">{SEPARATOR}</text>
			{bodyLines.map((line, i) => (
				<text key={"cmd-" + i} fg="#FFFFFF">
					{line}
				</text>
			))}
			<text fg="#888888">{SEPARATOR}</text>
			<text fg="#888888">{"Press any key to continue..."}</text>
		</box>,
	);

	return <box flexDirection="column">{children}</box>;
}
