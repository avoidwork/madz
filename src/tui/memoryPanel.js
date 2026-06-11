import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Memory panel that displays index entries with file viewer.
 * Props: entries - array of { title, path, timestamp }
 */
export function MemoryPanel({ entries = [], isActive = false }) {
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [focusIndex, setFocusIndex] = useState(0);

	const visibleEntries = entries.slice(0, 30);

	useInput(
		(input, key) => {
			if (key.upArrow && focusIndex > 0) {
				setFocusIndex((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow && focusIndex < visibleEntries.length - 1) {
				setFocusIndex((prev) => Math.min(visibleEntries.length - 1, prev + 1));
			}
			if (input === " ") {
				const entry = visibleEntries[focusIndex] || visibleEntries[0];
				if (entry) setSelectedEntry(entry);
			}
			if (key.escape) {
				setSelectedEntry(null);
			}
		},
		{ isActive },
	);

	return (
		<Box flexDirection="row">
			<Box flexDirection="column" width="50%">
				<Text bold color="cyan">
					{" "}
					Memory{" "}
				</Text>
				{visibleEntries.map((entry, i) => (
					<Box key={entry.title} borderColor={focusIndex === i ? "cyan" : "transparent"}>
						<Text>
							{focusIndex === i ? "▸ " : "  "}
							{entry.title}
						</Text>
					</Box>
				))}
				{entries.length === 0 && <Text gray> No memory entries.</Text>}
			</Box>
			{selectedEntry && (
				<Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray">
					<Text bold> {selectedEntry.title} </Text>
					<Text gray> Path: {selectedEntry.path}</Text>
					<Text gray> Date: {selectedEntry.timestamp}</Text>
				</Box>
			)}
		</Box>
	);
}
