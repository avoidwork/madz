/**
 * Autocomplete panel component for TUI file path autocomplete.
 * Renders a scrollable overlay above the input bar showing
 * filtered file paths with keyboard navigation support.
 */
import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView } from "ink-scroll-view";

/**
 * Autocomplete panel — renders a scrollable list of file paths.
 * @param {Object} props
 * @param {string[]} props.files - Array of file paths to display
 * @param {number} props.selectedIndex - Currently selected index
 * @param {(index: number) => void} props.onSelect - Callback when a file is selected
 * @param {() => void} props.onDismiss - Callback to dismiss the overlay
 * @param {number} [props.maxViewport] - Maximum number of visible entries
 * @returns {React.ReactElement}
 */
export function AutocompletePanel({
	files,
	selectedIndex,
	_onSelect,
	_onDismiss,
	maxViewport = 15,
}) {
	const { stdout } = useStdout();
	const [viewport, setViewport] = useState(maxViewport);
	const listRef = useRef(null);

	useEffect(() => {
		const updateSize = () => {
			setViewport(Math.min(maxViewport, stdout.rows - 5));
		};
		updateSize();
		stdout.on("resize", updateSize);
		return () => stdout.off("resize", updateSize);
	}, [stdout, maxViewport]);

	// Auto-scroll to selected item
	useEffect(() => {
		if (listRef.current && selectedIndex >= 0 && selectedIndex < files.length) {
			const visibleStart = Math.max(0, selectedIndex - Math.floor(viewport / 2));
			listRef.current.scrollTo(visibleStart);
		}
	}, [selectedIndex, files.length, viewport]);

	if (files.length === 0) {
		return null;
	}

	return React.createElement(
		Box,
		{
			flexDirection: "column",
			borderStyle: "single",
			borderColor: "blue",
			paddingX: 1,
			paddingY: 0,
			width: Math.min(60, stdout.columns - 4),
		},
		React.createElement(
			Text,
			{
				bold: true,
				color: "blue",
			},
			` ${files.length} file${files.length !== 1 ? "s" : ""}`,
		),
		React.createElement(
			ScrollView,
			{
				ref: listRef,
				height: viewport,
				width: Math.min(60, stdout.columns - 6),
				hideScrollbar: true,
			},
			files.slice(0, viewport).map((file, idx) => {
				const isSelected = idx === selectedIndex;
				return React.createElement(
					Box,
					{
						key: idx,
						paddingX: 1,
						backgroundColor: isSelected ? "blue" : undefined,
					},
					React.createElement(
						Text,
						{
							color: isSelected ? "black" : "gray",
						},
						`${isSelected ? "▸ " : "  "}${file}`,
					),
				);
			}),
		),
		React.createElement(
			Text,
			{
				color: "gray",
			},
			` ↑↓ navigate  enter select  esc dismiss`,
		),
	);
}
