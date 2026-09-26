import React, { useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import SelectInput from "ink-select-input";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

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
 * Projects panel that lists directories within `projects/` for selection.
 * Uses ink-select-input for navigation and selection — no descriptions,
 * mirroring the /skills list style.
 * Props:
 *   cwd           - Base directory containing the projects/ folder
 *   onViewChange  - Callback to switch back to conversation view
 *   onSelectProject - Callback invoked with the selected project path on Enter
 *   activeView    - The current active view name (from PANELS)
 */
export function ProjectsPanel({ cwd, onViewChange, onSelectProject, activeView }) {
	const isActive = activeView === "projects";
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header rows.
	const limit = Math.max(1, rows - 4);

	// Discover project directories under <cwd>/projects/.
	const [projects, setProjects] = React.useState([]);
	const [loaded, setLoaded] = React.useState(false);

	React.useEffect(() => {
		let cancelled = false;
		const projectsDir = join(cwd || process.cwd(), "projects");
		readdir(projectsDir, { withFileTypes: true })
			.then((entries) => {
				if (cancelled) return;
				const dirs = entries
					.filter((e) => e.isDirectory())
					.map((e) => e.name)
					.sort((a, b) => a.localeCompare(b));
				setProjects(dirs);
				setLoaded(true);
			})
			.catch(() => {
				if (cancelled) return;
				setProjects([]);
				setLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, [cwd]);

	// Normalize to SelectInput items (label = directory name, value = full path).
	const items = useMemo(
		() =>
			projects.map((name) => ({
				label: name,
				value: resolve(join(cwd || process.cwd(), "projects", name)),
			})),
		[projects, cwd],
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

	if (!loaded) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Projects"),
			React.createElement(Text, { color: "gray" }, " Loading projects..."),
		);
	}

	if (items.length === 0) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Projects"),
			React.createElement(Text, { color: "gray" }, " No projects found in ./projects/."),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Projects"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter select, Escape back"),
		React.createElement(SelectInput, {
			items,
			isFocused: isActive,
			limit,
			indicatorComponent: CyanIndicator,
			onSelect: (item) => onSelectProject?.(item.value),
		}),
	);
}
