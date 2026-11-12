import React from "react";
import { Box, Text } from "ink";

/**
 * Shared item renderer for selectable lists (SelectInput and custom lists).
 * Highlights the selected row in white, non-selected rows in gray — matching
 * the input panel and status bar color scheme.
 * @param {{ isSelected?: boolean, label: string }} props - The item props.
 * @returns {React.ReactElement} The rendered item.
 */
export function ActiveItem({ isSelected = false, label }) {
	return React.createElement(Text, { color: isSelected ? "white" : "gray" }, label);
}

/**
 * Shared indicator renderer for selectable lists. Renders the pointer in white
 * when selected, gray when not — matching the item color scheme.
 * @param {{ isSelected?: boolean }} props - The indicator props.
 * @returns {React.ReactElement} The rendered indicator.
 */
export function ActiveIndicator({ isSelected = false }) {
	return React.createElement(
		Box,
		{ marginRight: 1 },
		isSelected
			? React.createElement(Text, { color: "white" }, "→")
			: React.createElement(Text, { color: "gray" }, " "),
	);
}
