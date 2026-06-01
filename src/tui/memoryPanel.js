import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Memory panel that displays index entries with file viewer.
 * Props: entries, highContrast
 * @param {object} props
 * @param {Array} [props.entries] - Array of { title, path, timestamp }
 * @param {boolean} [props.highContrast] - High-contrast display mode
 */
export function MemoryPanel({ entries = [], highContrast = false }) {
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [focusIndex, setFocusIndex] = useState(0);

	const visibleEntries = entries.slice(0, 30);

	useInput((_, key) => {
		if (key.up && focusIndex > 0) {
			setFocusIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.down && focusIndex < visibleEntries.length - 1) {
			setFocusIndex((prev) => Math.min(visibleEntries.length - 1, prev + 1));
		}
		if (key.space) {
			const entry = visibleEntries[focusIndex] || visibleEntries[0];
			if (entry) setSelectedEntry(entry);
		}
		if (key.escape) {
			setSelectedEntry(null);
		}
	});

	return (
		<Box flexDirection="row">
			<Box flexDirection="column" width="50%">
				<Text bold color="cyan">
					{" "}
					Memory{" "}
				</Text>
				{visibleEntries.map((entry, i) => (
					<Box key={entry.title} borderColor={focusIndex === i ? "cyan" : "transparent"}>
						<Text
							color={focusIndex === i && highContrast ? "white" : undefined}
							bold={focusIndex === i && highContrast}
						>
							{focusIndex === i ? "▸ " : "  "}
							{entry.title}
						</Text>
					</Box>
				))}
				{entries.length === 0 && <Text gray> No memory entries.</Text>}
			</Box>
			{selectedEntry && (
				<Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray">
					<Text bold {...(highContrast && { color: "white" })}>
						{" "}
						{selectedEntry.title}{" "}
					</Text>
					<Text gray dim={!highContrast} bold={highContrast}>
						{" "}
						Path: {selectedEntry.path}
					</Text>
					<Text gray dim={!highContrast} bold={highContrast}>
						{" "}
						Date: {selectedEntry.timestamp}
					</Text>
				</Box>
			)}
		</Box>
	);
}
