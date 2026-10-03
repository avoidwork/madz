import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";

/**
 * Custom item renderer for the settings list that highlights the selected row
 * in cyan, matching the /skills and /memory views. ink-select-input's default
 * Item uses blue.
 * @param {{ isSelected?: boolean, label: string }} props - The item props.
 * @returns {React.ReactElement} The rendered item.
 */
function CyanItem({ isSelected = false, label }) {
	return React.createElement(Text, { color: isSelected ? "cyan" : undefined }, label);
}

/**
 * Custom indicator renderer for the settings list that renders the pointer in
 * cyan, matching the /skills and /memory views. ink-select-input's default
 * Indicator uses blue.
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
 * Clamp a scroll offset so the selected row stays within the visible window.
 * @param {number} offset - Current first-visible index.
 * @param {number} selectedIndex - The selected row index.
 * @param {number} itemsLength - Total number of items.
 * @param {number} limit - Maximum visible rows.
 * @returns {number} The clamped offset.
 */
export function clampOffset(offset, selectedIndex, itemsLength, limit) {
	const maxOffset = Math.max(0, itemsLength - limit);
	let next = Math.min(offset, maxOffset);
	if (selectedIndex < next) next = selectedIndex;
	if (selectedIndex >= next + limit) next = selectedIndex - limit + 1;
	return Math.max(0, Math.min(next, maxOffset));
}

/**
 * Custom selectable list for the settings panel.
 *
 * ink-select-input resets its selection to index 0 whenever the `items` array
 * changes (see its internal `useEffect`). In the settings view, expanding or
 * collapsing a section rebuilds the items array, which would jump the cursor
 * back to the top. This component manages selection state itself so the
 * selected row stays put — only the rows below it shift when a section is
 * toggled.
 *
 * @param {{ items: Array<{ label: string, value: any, key: string }>, isFocused: boolean, limit: number, onSelect: (item: any) => void }} props
 * @returns {React.ReactElement} The rendered list.
 */
function SettingsSelectList({ items, isFocused, limit, onSelect }) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [offset, setOffset] = useState(0);

	// Preserve the selection across item changes (expand/collapse). The selected
	// row is always a section header, so it stays at the same index; we only
	// clamp it and the offset to the valid range.
	useEffect(() => {
		setSelectedIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
		setOffset((prev) => {
			const sel = Math.min(selectedIndex, Math.max(0, items.length - 1));
			return clampOffset(prev, sel, items.length, limit);
		});
	}, [items, limit, selectedIndex]);

	useInput(
		(input, key) => {
			if (input === "k" || key.upArrow) {
				setSelectedIndex((prev) => {
					const next = prev === 0 ? items.length - 1 : prev - 1;
					setOffset((o) => clampOffset(o, next, items.length, limit));
					return next;
				});
			} else if (input === "j" || key.downArrow) {
				setSelectedIndex((prev) => {
					const next = prev === items.length - 1 ? 0 : prev + 1;
					setOffset((o) => clampOffset(o, next, items.length, limit));
					return next;
				});
			} else if (key.return) {
				onSelect?.(items[selectedIndex]);
			}
		},
		{ isActive: isFocused },
	);

	const visible = items.slice(offset, offset + limit);
	return React.createElement(
		Box,
		{ flexDirection: "column" },
		visible.map((item, i) => {
			const idx = offset + i;
			const isSelected = idx === selectedIndex;
			return React.createElement(
				Box,
				{ key: item.key ?? idx },
				React.createElement(CyanIndicator, { isSelected }),
				React.createElement(CyanItem, { label: item.label, isSelected }),
			);
		}),
	);
}

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
		React.createElement(SettingsSelectList, {
			items,
			isFocused: isActive,
			limit,
			onSelect: handleSelect,
		}),
	);
}
