import React from "react";
import { Box, Text } from "ink";

/**
 * Bottom status bar / input panel.
 * Displays: cursor | input | | status | skills | messages
 */
export function StatusBar({
	inputText = "",
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
}) {
	const isCommand = inputText ? inputText.startsWith(":") : false;

	return (
		<Box flexDirection="row" alignItems="center" paddingX={1}>
			<Text color="bold">└─ </Text>
			<Text color={isCommand ? "magenta" : "green"}>
				{inputText}
				<Text color="green">│</Text>
			</Text>
			<Text color="dim"> {statusMessage}</Text>
			<Box flexDirection="column">
				<Text color="dim" size={{ width: 1 }}>
					skills:{skillCount} msg:{messageCount}
				</Text>
				<Text color="dim" size={{ width: 1 }}>
					↑↓ history | ↑↓ scroll | esc quit
				</Text>
			</Box>
		</Box>
	);
}
