/**
 * Settings panel section for the TUI.
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Settings panel that shows current config sections.
 * Props: configSections - array of section names
 */
export function SettingsPanel({ configSections = [], isActive = false }) {
	const [focusIndex, setFocusIndex] = useState(0);
	const [selectedSection, setSelectedSection] = useState(null);

	useInput(
		(_, key) => {
			if (key.upArrow && focusIndex > 0) {
				setFocusIndex((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow && focusIndex < configSections.length - 1) {
				setFocusIndex((prev) => Math.min(configSections.length - 1, prev + 1));
			}
			if (key.return) {
				setSelectedSection(configSections[focusIndex] || null);
			}
			if (key.escape) {
				setSelectedSection(null);
			}
		},
		{ isActive },
	);

	return (
		<Box flexDirection="row">
			<Box flexDirection="column" width="45%">
				<Text bold color="cyan">
					{" "}
					Settings{" "}
				</Text>
				{configSections.map((section, i) => (
					<Box key={section} borderColor={focusIndex === i ? "cyan" : "transparent"}>
						<Text>
							{focusIndex === i ? "▸ " : "  "}
							{section}
						</Text>
					</Box>
				))}
			</Box>
			{selectedSection && (
				<Box flexDirection="column" width="55%" borderStyle="single" borderColor="gray">
					<Text bold> {selectedSection} </Text>
					<Text gray> Edit config values here.</Text>
					<Text gray> Use :config set &lt;key&gt; &lt;value&gt;.</Text>
				</Box>
			)}
		</Box>
	);
}
