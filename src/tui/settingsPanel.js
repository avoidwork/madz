import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import SelectInput from "ink-select-input";

/**
 * Flatten a nested config object into an array of { path, value } pairs,
 * skipping null/undefined leaves and circular refs.
 */
function flattenConfig(obj, prefix = "") {
	const entries = [];
	if (!obj || typeof obj !== "object") {
		if (obj !== undefined && obj !== null) {
			entries.push({ path: prefix, value: String(obj) });
		}
		return entries;
	}
	for (const [key, val] of Object.entries(obj)) {
		const fullPath = prefix ? `${prefix}.${key}` : key;
		if (val !== null && val !== undefined && typeof val === "object" && !Array.isArray(val)) {
			entries.push(...flattenConfig(val, fullPath));
		} else if (Array.isArray(val)) {
			entries.push({ path: fullPath, value: `[${val.length} items]` });
			val.forEach((item, idx) => {
				if (item !== null && typeof item === "object") {
					entries.push(...flattenConfig(item, `${fullPath}[${idx}]`));
				} else {
					entries.push({ path: `${fullPath}[${idx}]`, value: String(item) });
				}
			});
		} else if (val !== undefined && val !== null) {
			entries.push({ path: fullPath, value: String(val) });
		}
	}
	return entries;
}

/**
 * Get top-level config section names, excluding internal keys.
 */
function getConfigSections(config) {
	if (!config || typeof config !== "object") return [];
	const skip = new Set(["cwd"]);
	return Object.keys(config).filter((k) => !skip.has(k));
}

/**
 * SettingsPanel — read-only config section browser with collapsible groups.
 * Props:
 *   config    - App config object
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView  - The current active view name (from PANELS)
 */
export function SettingsPanel({ config, onViewChange, activeView }) {
	const isActive = activeView === "settings";
	const sections = useMemo(() => getConfigSections(config), [config]);
	const [expandedSection, setExpandedSection] = useState(null);
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header rows.
	const limit = Math.max(1, rows - 4);

	// Build a flat selectable list: section headers + (when expanded) their entries
	const items = useMemo(() => {
		const list = [];
		for (const section of sections) {
			const isExpanded = expandedSection === section;
			list.push({
				label: `${isExpanded ? "▼" : "▶"} ${section}`,
				value: { type: "section", name: section },
				key: `section-${section}`,
			});
			if (isExpanded) {
				for (const entry of flattenConfig(config?.[section])) {
					const display = entry.value.length > 80 ? `${entry.value.slice(0, 80)}...` : entry.value;
					list.push({
						label: `  ${entry.path}: ${display}`,
						value: { type: "entry", path: entry.path },
						key: `entry-${section}-${entry.path}`,
					});
				}
			}
		}
		return list;
	}, [sections, expandedSection, config]);

	const handleSelect = (item) => {
		const v = item.value;
		if (v.type === "section") {
			setExpandedSection((prev) => (prev === v.name ? null : v.name));
		}
		// Entries are read-only — no action on select
	};

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	if (!config) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Settings"),
			React.createElement(Text, { color: "gray" }, " No config available."),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Settings"),
		React.createElement(
			Text,
			{ color: "gray" },
			expandedSection
				? " ↑↓ navigate, Enter collapse, Escape back"
				: " ↑↓ navigate, Enter expand, Escape back",
		),
		React.createElement(SelectInput, {
			items,
			isFocused: isActive,
			limit,
			onSelect: handleSelect,
		}),
	);
}
