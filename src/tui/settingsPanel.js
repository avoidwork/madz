import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";

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
 *   isActive  - Whether this panel is the active input target
 */
export function SettingsPanel({ config, onViewChange, isActive = false }) {
	const sections = useMemo(() => getConfigSections(config), [config]);

	const [focusIndex, setFocusIndex] = useState(0);
	const [expandedSection, setExpandedSection] = useState(null);

	// Flattened entries for the currently expanded section
	const expandedEntries = useMemo(() => {
		if (!expandedSection || !config?.[expandedSection]) return [];
		return flattenConfig(config[expandedSection]);
	}, [config, expandedSection]);

	// Total list length: sections list + expanded entries
	const totalLen = expandedSection ? sections.length + expandedEntries.length : sections.length;

	useInput(
		(_, key) => {
			if (key.upArrow && focusIndex > 0) {
				setFocusIndex((prev) => prev - 1);
			}
			if (key.downArrow && focusIndex < totalLen - 1) {
				setFocusIndex((prev) => prev + 1);
			}
			if (key.return) {
				if (expandedSection) {
					// If focus is on a section header, collapse it
					const sectionIdx = sections.indexOf(expandedSection);
					if (focusIndex <= sectionIdx) {
						setExpandedSection(null);
						setFocusIndex(sectionIdx);
					}
					// Otherwise focus is on a detail entry — no action needed (read-only)
				} else {
					// Expand the focused section
					const section = sections[focusIndex];
					if (section) {
						setExpandedSection(section);
						// Focus stays on the section header (index 0 of expanded view)
					}
				}
			}
			if (key.escape) {
				if (expandedSection) {
					const sectionIdx = sections.indexOf(expandedSection);
					setExpandedSection(null);
					setFocusIndex(sectionIdx);
				} else {
					onViewChange?.("conversation");
				}
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

	// Build the rendered list
	const renderItems = [];
	let globalIdx = 0;

	for (let i = 0; i < sections.length; i++) {
		const section = sections[i];
		const isExpanded = expandedSection === section;
		const isFocused = focusIndex === globalIdx;

		renderItems.push(
			React.createElement(
				Box,
				{
					key: `section-${section}`,
					flexDirection: "row",
					borderColor: isFocused ? "cyan" : "transparent",
				},
				React.createElement(Text, null, isFocused ? "▸ " : "  ", isExpanded ? "▼ " : "▶ ", section),
			),
		);
		globalIdx++;

		// Render expanded entries
		if (isExpanded) {
			for (const entry of expandedEntries) {
				const isEntryFocused = focusIndex === globalIdx;
				renderItems.push(
					React.createElement(
						Box,
						{
							key: `entry-${entry.path}`,
							flexDirection: "row",
							paddingLeft: 3,
							borderColor: isEntryFocused ? "cyan" : "transparent",
						},
						React.createElement(
							Text,
							null,
							isEntryFocused ? "▸ " : "  ",
							React.createElement(Text, { color: "gray" }, entry.path),
							": ",
							entry.value.length > 80 ? entry.value.slice(0, 80) + "..." : entry.value,
						),
					),
				);
				globalIdx++;
			}
		}
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Settings"),
		React.createElement(
			Text,
			{ color: "gray" },
			expandedSection
				? " ↑↓ navigate, Enter/ Escape collapse, Escape back"
				: " ↑↓ navigate, Enter expand, Escape back",
		),
		...renderItems,
	);
}
