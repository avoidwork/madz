import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";

/**
 * Skills panel that lists registered skills with a live filter.
 * Props:
 *   skills    - array of skill names
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView  - The current active view name (from PANELS)
 */
export function SkillsPanel({ skills = [], onViewChange, activeView }) {
	const isActive = activeView === "skills";
	const [searchQuery, setSearchQuery] = useState("");
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header + filter rows.
	const limit = Math.max(1, rows - 4);

	const filteredSkills = useMemo(
		() => skills.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase())),
		[skills, searchQuery],
	);

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	const items = filteredSkills.map((skill) => ({ label: skill, value: skill }));

	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(Text, { bold: true, color: "cyan" }, " Skills"),
		React.createElement(TextInput, {
			value: searchQuery,
			onChange: setSearchQuery,
			placeholder: "Filter skills...",
			focus: isActive,
			showCursor: true,
		}),
		skills.length === 0
			? React.createElement(Text, { color: "gray" }, " No skills registered.")
			: filteredSkills.length === 0
				? React.createElement(Text, { color: "gray" }, " No skills match filter.")
				: React.createElement(SelectInput, {
						items,
						isFocused: false,
						limit,
					}),
	);
}
