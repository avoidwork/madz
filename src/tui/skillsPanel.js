import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Skills panel that lists registered skills with search.
 * Props: skills, highContrast
 * @param {object} props
 * @param {string[]} [props.skills] - Array of skill names
 * @param {boolean} [props.highContrast] - High-contrast display mode
 */
export function SkillsPanel({ skills = [], highContrast = false }) {
	const [searchQuery, _setSearchQuery] = useState("");
	const [focusedSkill, setFocusedSkill] = useState(0);

	const filteredSkills = skills.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

	useInput((_, key) => {
		if (key.up && focusedSkill > 0) {
			setFocusedSkill((prev) => Math.max(0, prev - 1));
		}
		if (key.down && focusedSkill < filteredSkills.length - 1) {
			setFocusedSkill((prev) => Math.min(filteredSkills.length - 1, prev + 1));
		}
	});

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{" "}
				Skills{" "}
			</Text>
			<Text gray dim={!highContrast} bold={highContrast}>
				{" "}
				Filter: {searchQuery || "all"}
			</Text>
			{filteredSkills.map((skill, i) => (
				<Box key={skill} borderColor={focusedSkill === i ? "cyan" : "transparent"}>
					<Text
						color={focusedSkill === i && highContrast ? "white" : undefined}
						bold={focusedSkill === i && highContrast}
					>
						{focusedSkill === i ? "▸ " : "  "}
						{skill}
					</Text>
				</Box>
			))}
			{skills.length === 0 && <Text gray> No skills registered.</Text>}
		</Box>
	);
}
