import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { COMMAND_GROUPS } from "./commandHelp.js";

export const BANNER_ART = `
   . .    .       . .       . .             
.+'|=|\`+.=|\`+. .+'|=|\`+. .+'|=|\`+. |~~|=|~~|
|  | \`+ | \`+ | |  | |  | |  | \`+ | |.+' |  |
|  |  | |  | | |  |=|  | |  |  | |      |.+'
|  |  | |  | | |  | |  | |  |  | |    .='   
|  |  | |  | | |  | |  | |  |  | | .+'|    .
|  |  | |  | | |  | |  | |  | .+ | |  | .+'|
\`+.|  |.|  |+' \`+.| |..| \`+.|=|.+' |..|=|..|
`.split("\n");

/** Hint shown above the command menu explaining the Tab key. */
export const TAB_HINT = "Tab: select mode for native text selection and copy (any key exits)";

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
		children.push(
			React.createElement(
				Box,
				{ flexDirection: "column", marginTop: 1 },
				React.createElement(Text, { key: "version" }, version),
			),
		);
	}

	children.push(
		React.createElement(
			Box,
			{ key: "tab-hint", flexDirection: "column", marginTop: 2 },
			React.createElement(Text, { color: "cyan" }, TAB_HINT),
		),
	);

	children.push(
		React.createElement(
			Box,
			{ flexDirection: "column", marginTop: 1 },
			...bodyLines.map((line, i) =>
				React.createElement(Text, { key: "cmd-" + i, color: "white" }, line),
			),
		),
	);

	children.push(
		React.createElement(
			Box,
			{ flexDirection: "column", marginTop: 2 },
			React.createElement(Text, { color: "gray" }, "Press any key to continue..."),
		),
	);

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, paddingY: 1 },
		...children,
	);
}
