import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Skills panel that lists registered skills with search.
 * Props: skills - array of skill names
 */
export function SkillsPanel({ skills = [], isActive = false }) {
	const [searchQuery, _setSearchQuery] = useState("");
	const [focusedSkill, setFocusedSkill] = useState(0);

	const filteredSkills = skills.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

	useInput(
		(_, key) => {
			if (key.upArrow && focusedSkill > 0) {
				setFocusedSkill((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow && focusedSkill < filteredSkills.length - 1) {
				setFocusedSkill((prev) => Math.min(filteredSkills.length - 1, prev + 1));
			}
		},
		{ isActive },
	);

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{" "}
				Skills{" "}
			</Text>
			<Text gray> Filter: {searchQuery || "all"}</Text>
			{filteredSkills.map((skill, i) => (
				<Box key={skill} borderColor={focusedSkill === i ? "cyan" : "transparent"}>
					<Text>
						{focusedSkill === i ? "▸ " : "  "}
						{skill}
					</Text>
				</Box>
			))}
			{skills.length === 0 && <Text gray> No skills registered.</Text>}
		</Box>
	);
}
