import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";

/**
 * Skills panel that lists registered skills with a live filter.
 * Uses a single useInput handler for both filtering and list navigation
 * to avoid the focus conflict between ink-text-input and ink-select-input.
 * Props:
 *   skills    - array of skill names or catalog entries ({ name, description })
 *   onViewChange  - Callback to switch back to conversation view
 *   onSelectSkill  - Callback invoked with the selected skill name on Enter
 *   activeView  - The current active view name (from PANELS)
 */
export function SkillsPanel({ skills = [], onViewChange, onSelectSkill, activeView }) {
	const isActive = activeView === "skills";
	const [searchQuery, setSearchQuery] = useState("");
	const [focusIndex, setFocusIndex] = useState(0);

	// Normalize skills to { name, description } — accept either string names
	// or catalog entries from registry.getCatalog().
	const normalized = useMemo(
		() =>
			skills.map((s) =>
				typeof s === "string"
					? { name: s, description: "" }
					: { name: s.name, description: s.description || "" },
			),
		[skills],
	);

	const filteredSkills = useMemo(
		() => normalized.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())),
		[normalized, searchQuery],
	);

	// Clamp focus index when the filtered list shrinks.
	const clampedIndex = Math.min(focusIndex, Math.max(0, filteredSkills.length - 1));

	useInput(
		(input, key) => {
			if (!isActive) return;
			if (key.escape) {
				onViewChange?.("conversation");
				return;
			}
			if (key.upArrow) {
				setFocusIndex((prev) => (prev <= 0 ? filteredSkills.length - 1 : prev - 1));
				return;
			}
			if (key.downArrow) {
				setFocusIndex((prev) => (prev >= filteredSkills.length - 1 ? 0 : prev + 1));
				return;
			}
			if (key.return) {
				const selected = filteredSkills[clampedIndex];
				if (selected) {
					onSelectSkill?.(selected.name);
				}
				return;
			}
			if (key.backspace || key.delete) {
				setSearchQuery((prev) => prev.slice(0, -1));
				return;
			}
			// Printable characters build the filter query.
			if (input && input.length === 1 && input >= " ") {
				setSearchQuery((prev) => prev + input);
			}
		},
		{ isActive },
	);

	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(Text, { bold: true, color: "cyan" }, " Skills"),
		React.createElement(Text, { color: "gray" }, " Filter: ", searchQuery || "all"),
		normalized.length === 0
			? React.createElement(Text, { color: "gray" }, " No skills registered.")
			: filteredSkills.length === 0
				? React.createElement(Text, { color: "gray" }, " No skills match filter.")
				: filteredSkills.map((skill, i) => {
						const isSelected = i === clampedIndex;
						const desc = skill.description
							? skill.description.length > 50
								? `${skill.description.slice(0, 50)}...`
								: skill.description
							: "";
						return React.createElement(
							Box,
							{ key: skill.name, flexDirection: "column" },
							React.createElement(
								Text,
								{ color: isSelected ? "cyan" : undefined },
								isSelected ? "▸ " : "  ",
								skill.name,
							),
							desc ? React.createElement(Text, { color: "gray" }, "    ", desc) : null,
						);
					}),
	);
}
