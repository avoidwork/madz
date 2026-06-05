// skillsPanel.js - TUI skills panel
import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";

/**
 * Skills panel that lists registered skills with search.
 * @param {object} props
 * @param {string[]} props.skills
 */
export function SkillsPanel({ skills = [] }) {
	const [searchQuery, _setSearchQuery] = useState("");
	const [focusedSkill, setFocusedSkill] = useState(0);

	const filteredSkills = skills.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

	useKeyboard((event) => {
		const { key } = event;
		if (key.name === "up" && focusedSkill > 0) {
			setFocusedSkill((prev) => Math.max(0, prev - 1));
		}
		if (key.name === "down" && focusedSkill < filteredSkills.length - 1) {
			setFocusedSkill((prev) => Math.min(filteredSkills.length - 1, prev + 1));
		}
	});

	return (
		<box flexDirection="column">
			<text bold fg="#00FFFF">
				{" "}
				Skills{" "}
			</text>
			<text fg="#888888"> Filter: {searchQuery || "all"}</text>
			{filteredSkills.map((skill, i) => (
				<box key={skill} borderColor={focusedSkill === i ? "#00FFFF" : "transparent"}>
					<text>
						{focusedSkill === i ? "\u25B8 " : "  "}
						{skill}
					</text>
				</box>
			))}
			{skills.length === 0 && <text fg="#888888"> No skills registered.</text>}
		</box>
	);
}
