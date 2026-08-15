import React from "react";
import { Box, Text } from "ink";

/**
 * Autocomplete dropdown component.
 * Renders a list of matching file paths below the input line.
 * Highlights the selected item and shows "No files match" when empty.
 * @param {Object} props
 * @param {string[]} props.matches - List of matching file paths
 * @param {number} props.selectedIndex - Currently selected index
 * @param {() => void} props.onDismiss - Callback when dismissed (Esc)
 * @returns {React.ReactElement}
 */
export function AutoCompleteDropdown({ matches, selectedIndex, _onDismiss }) {
	const hasMatches = matches && matches.length > 0;

	const items = hasMatches
		? matches.map((match, index) => {
				const isSelected = index === selectedIndex;
				const prefix = isSelected ? "▸ " : "  ";
				return React.createElement(
					Box,
					{ key: match },
					React.createElement(Text, { color: isSelected ? "cyan" : "white" }, `${prefix}${match}`),
				);
			})
		: [React.createElement(Text, { key: "no-match", color: "gray" }, "No files match")];

	return React.createElement(
		Box,
		{
			flexDirection: "column",
			paddingX: 1,
			paddingY: 0,
		},
		...items,
	);
}
