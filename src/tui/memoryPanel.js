import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import SelectInput from "ink-select-input";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";

/**
 * Custom item renderer for SelectInput that highlights the selected row in cyan,
 * matching the /skills view. ink-select-input's default Item uses blue.
 * @param {{ isSelected?: boolean, label: string }} props - The item props.
 * @returns {React.ReactElement} The rendered item.
 */
function CyanItem({ isSelected = false, label }) {
	return React.createElement(Text, { color: isSelected ? "cyan" : undefined }, label);
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
 * MemoryPanel — browse canonical user memories from memory/context/.
 * Filters out ephemeral-*.md, reflection.md, clarifications.md.
 * Props:
 *   config    - App config (for memory.contextDir)
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView  - The current active view name (from PANELS)
 */
export function MemoryPanel({ config, onViewChange, activeView }) {
	const isActive = activeView === "memory";
	const [entries, setEntries] = useState([]);
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [detailContent, setDetailContent] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header + detail viewer rows.
	const limit = Math.max(1, rows - 8);

	// Async load memory entries
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const contextDir = config?.memory?.contextDir || "memory/context/";
				const cwd = config?.cwd || process.cwd();
				const dir = join(cwd, contextDir);
				let files;
				try {
					files = await readdir(dir);
				} catch (_err) {
					setEntries([]);
					setLoading(false);
					return;
				}
				const mdFiles = files.filter((f) => f.endsWith(".md"));
				const filtered = mdFiles.filter((f) => {
					// Exclude ephemeral memories
					if (f.startsWith("ephemeral-")) return false;
					// Exclude system files
					if (f === "reflection.md" || f === "clarifications.md") return false;
					return true;
				});
				const entries = [];
				for (const file of filtered) {
					try {
						const filepath = join(dir, file);
						const st = await stat(filepath);
						const content = await readFile(filepath, "utf-8");
						const { frontmatter } = parseFrontmatter(content);
						entries.push({
							title: file.replace(/\.md$/, ""),
							fileName: file,
							path: filepath,
							mtime: st.mtime,
							size: st.size,
							frontmatter,
						});
					} catch (_err) {
						// skip unreadable files
					}
				}
				// Sort by timestamp descending (newest first)
				// Use createdDate → updatedDate → timestamp → mtime
				entries.sort((a, b) => {
					const getTs = (e) => {
						const fm = e.frontmatter || {};
						return fm.createdDate || fm.updatedDate || fm.timestamp || e.mtime.toISOString();
					};
					return getTs(b).localeCompare(getTs(a));
				});
				if (!cancelled) {
					setEntries(entries);
					setLoading(false);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err.message);
					setLoading(false);
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [config?.memory?.contextDir, config?.cwd]);

	// Load detail content for a given entry.
	// Accepts either the entry object directly (from the mount effect) or the
	// SelectInput item shape { label, value, key } (from onHighlight/onSelect).
	const loadDetail = useCallback(async (itemOrEntry) => {
		const entry =
			itemOrEntry?.value && typeof itemOrEntry.value === "object" ? itemOrEntry.value : itemOrEntry;
		if (!entry) return;
		setSelectedEntry(entry);
		try {
			const content = await readFile(entry.path, "utf-8");
			const { frontmatter, content: body } = parseFrontmatter(content);
			setDetailContent({ frontmatter, body });
		} catch (err) {
			setDetailContent({ frontmatter: {}, body: `Error reading file: ${err.message}` });
		}
	}, []);

	// Show the first entry's detail once entries load
	useEffect(() => {
		if (entries.length > 0 && !selectedEntry) {
			loadDetail(entries[0]);
		}
	}, [entries, selectedEntry, loadDetail]);

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	if (loading) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Memory"),
			React.createElement(Text, { color: "gray" }, " Loading memories..."),
		);
	}

	if (error) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Memory"),
			React.createElement(Text, { color: "red" }, ` Error: ${error}`),
		);
	}

	if (entries.length === 0) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Memory"),
			React.createElement(Text, { color: "gray" }, " No memory entries."),
		);
	}

	const items = entries.map((entry) => {
		const dateStr = entry.mtime.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
		return {
			label: `${entry.title}  ${dateStr}`,
			value: entry,
			key: entry.fileName,
		};
	});

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Memory"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter view, Escape back"),
		React.createElement(SelectInput, {
			items,
			isFocused: isActive,
			limit,
			indicatorComponent: CyanIndicator,
			itemComponent: CyanItem,
			onHighlight: loadDetail,
			onSelect: loadDetail,
		}),
		selectedEntry && detailContent
			? React.createElement(
					Box,
					{ flexDirection: "column", marginY: 1, borderStyle: "single", borderColor: "gray" },
					detailContent.frontmatter && Object.keys(detailContent.frontmatter).length > 0
						? React.createElement(
								Box,
								{ flexDirection: "column", marginBottom: 1 },
								...Object.entries(detailContent.frontmatter).map(([k, v]) =>
									React.createElement(Text, { key: k, color: "gray" }, " ", k, ": ", String(v)),
								),
							)
						: null,
					React.createElement(
						Text,
						null,
						detailContent.body || React.createElement(Text, { color: "gray" }, " (empty)"),
					),
				)
			: null,
	);
}
