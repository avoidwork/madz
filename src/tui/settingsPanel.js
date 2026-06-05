// settingsPanel.js - TUI settings panel
import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";

/**
 * Settings panel that shows current config sections.
 * @param {object} props
 * @param {string[]} props.configSections
 */
export function SettingsPanel({ configSections = [] }) {
	const [focusIndex, setFocusIndex] = useState(0);
	const [selectedSection, setSelectedSection] = useState(null);

	useKeyboard((event) => {
		const { key } = event;
		if (key.name === "up" && focusIndex > 0) {
			setFocusIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.name === "down" && focusIndex < configSections.length - 1) {
			setFocusIndex((prev) => Math.min(configSections.length - 1, prev + 1));
		}
		if (key.name === "return") {
			setSelectedSection(configSections[focusIndex] || null);
		}
		if (key.name === "escape") {
			setSelectedSection(null);
		}
	});

	return (
		<box flexDirection="row">
			<box flexDirection="column" width={45}>
				<text bold fg="#00FFFF">
					{" "}
					Settings{" "}
				</text>
				{configSections.map((section, i) => (
					<box key={section} borderColor={focusIndex === i ? "#00FFFF" : "transparent"}>
						<text>
							{focusIndex === i ? "\u25B8 " : "  "}
							{section}
						</text>
					</box>
				))}
			</box>
			{selectedSection && (
				<box flexDirection="column" width={55} borderStyle="single" borderColor="#888888">
					<text bold> {selectedSection} </text>
					<text fg="#888888"> Edit config values here.</text>
					<text fg="#888888">{" Use :config set <key> <value>."}</text>
				</box>
			)}
		</box>
	);
}
