import React, { useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import SelectInput from "ink-select-input";

/** Maximum length of a skill description before it is truncated with an ellipsis. */
export const DESCRIPTION_MAX_LENGTH = 500;

/**
 * Truncate a skill description for display.
 * Returns the description unchanged when it is at or under `max` characters,
 * otherwise returns the first `max` characters followed by an ellipsis.
 * @param {string} desc - The description to truncate.
 * @param {number} [max=DESCRIPTION_MAX_LENGTH] - The maximum allowed length.
 * @returns {string} The truncated (or unchanged) description.
 */
export function truncateDescription(desc, max = DESCRIPTION_MAX_LENGTH) {
	if (desc.length <= max) {
		return desc;
	}
	return `${desc.slice(0, max)}…`;
}

/**
 * Custom item renderer for SelectInput that highlights the selected skill name
 * in cyan and renders the description beneath it in gray.
 * @param {{ isSelected?: boolean, label: string, description?: string }} props - The item props.
 * @returns {React.ReactElement} The rendered item.
 */
function SkillItem({ isSelected = false, label, description }) {
	const desc = truncateDescription(description || "");
	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(Text, { color: isSelected ? "cyan" : undefined }, label),
		desc ? React.createElement(Text, { color: "gray" }, "    ", desc) : null,
	);
}

/**
 * Custom indicator renderer for SelectInput that renders the pointer in cyan,
 * matching the /skills view. ink-select-input's default Indicator uses blue.
 * @param {{ isSelected?: boolean }} props - The indicator props.
 * @returns {React.ReactElement} The rendered indicator.
 */
function CyanIndicator({ isSelected = false }) {
	return React.createElement(
		Box,
		{ marginRight: 1 },
		isSelected
			? React.createElement(Text, { color: "cyan" }, "▸")
			: React.createElement(Text, null, " "),
	);
}

/**
 * Skills panel that lists registered skills for selection.
 * Uses ink-select-input for navigation and selection.
 * Props:
 *   skills    - array of skill names or catalog entries ({ name, description })
 *   onViewChange  - Callback to switch back to conversation view
 *   onSelectSkill  - Callback invoked with the selected skill name on Enter
 *   activeView  - The current active view name (from PANELS)
 */
export function SkillsPanel({ skills = [], onViewChange, onSelectSkill, activeView }) {
	const isActive = activeView === "skills";
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header rows.
	const limit = Math.max(1, rows - 4);

	// Normalize skills to { name, description } — accept either string names
	// or catalog entries from registry.getCatalog().
	const items = useMemo(
		() =>
			skills.map((s) => {
				const name = typeof s === "string" ? s : s.name;
				const description = typeof s === "string" ? "" : s.description || "";
				return {
					label: name,
					description,
					value: name,
					key: name,
				};
			}),
		[skills],
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

	if (items.length === 0) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Skills"),
			React.createElement(Text, { color: "gray" }, " No skills registered."),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Skills"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter run, Escape back"),
		React.createElement(SelectInput, {
			items,
			isFocused: isActive,
			limit,
			indicatorComponent: CyanIndicator,
			itemComponent: SkillItem,
			onSelect: (item) => onSelectSkill?.(item.value),
		}),
	);
}
