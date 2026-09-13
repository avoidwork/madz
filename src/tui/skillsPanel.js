import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

/**
 * Skills panel that lists registered skills with search.
 * Props: skills - array of skill names
 */
export function SkillsPanel({ skills = [], onViewChange, isActive = false }) {
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
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(Text, { bold: true, color: "cyan" }, " Skills"),
		React.createElement(Text, { color: "gray" }, " Filter: ", searchQuery || "all"),
		...filteredSkills.map((skill, i) =>
			React.createElement(
				Box,
				{ key: skill, borderColor: focusedSkill === i ? "cyan" : "transparent" },
				React.createElement(Text, null, focusedSkill === i ? "▸ " : "  ", skill),
			),
		),
		skills.length === 0
			? React.createElement(Text, { color: "gray" }, " No skills registered.")
			: null,
	);
}
