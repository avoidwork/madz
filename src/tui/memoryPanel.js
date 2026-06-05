// memoryPanel.js - TUI memory panel
import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";

/**
 * Memory panel that displays index entries with file viewer.
 * @param {object} props
 * @param {Array} props.entries
 */
export function MemoryPanel({ entries = [] }) {
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [focusIndex, setFocusIndex] = useState(0);

	const visibleEntries = entries.slice(0, 30);

	useKeyboard((event) => {
		const { key } = event;
		if (key.name === "up" && focusIndex > 0) {
			setFocusIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.name === "down" && focusIndex < visibleEntries.length - 1) {
			setFocusIndex((prev) => Math.min(visibleEntries.length - 1, prev + 1));
		}
		if (key.name === "space") {
			const entry = visibleEntries[focusIndex] || visibleEntries[0];
			if (entry) setSelectedEntry(entry);
		}
		if (key.name === "escape") {
			setSelectedEntry(null);
		}
	});

	return (
		<box flexDirection="row">
			<box flexDirection="column" width={50}>
				<text bold fg="#00FFFF">
					{" "}
					Memory{" "}
				</text>
				{visibleEntries.map((entry, i) => (
					<box key={entry.title} borderColor={focusIndex === i ? "#00FFFF" : "transparent"}>
						<text>
							{focusIndex === i ? "\u25B8 " : "  "}
							{entry.title}
						</text>
					</box>
				))}
				{entries.length === 0 && <text fg="#888888"> No memory entries.</text>}
			</box>
			{selectedEntry && (
				<box flexDirection="column" width={50} borderStyle="single" borderColor="#888888">
					<text bold> {selectedEntry.title} </text>
					<text fg="#888888"> Path: {selectedEntry.path}</text>
					<text fg="#888888"> Date: {selectedEntry.timestamp}</text>
				</box>
			)}
		</box>
	);
}
