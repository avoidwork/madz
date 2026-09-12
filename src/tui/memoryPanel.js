import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";

/**
 * MemoryPanel — browse canonical user memories from memory/context/.
 * Filters out ephemeral-*.md, reflection.md, clarifications.md.
 * Props:
 *   config    - App config (for memory.contextDir)
 *   isActive  - Whether this panel is the active input target
 */
export function MemoryPanel({ config, onViewChange, isActive = false }) {
	const [entries, setEntries] = useState([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [detailContent, setDetailContent] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

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
		return () => { cancelled = true; };
	}, [config?.memory?.contextDir, config?.cwd]);

	const handleSelect = useCallback(async (entry) => {
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

	useInput(
		(input, key) => {
			if (selectedEntry) {
				// Detail view mode — Escape closes detail
				if (key.escape) {
					setSelectedEntry(null);
					setDetailContent(null);
				}
				return;
			}
			if (key.upArrow && focusIndex > 0) {
				setFocusIndex((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow && focusIndex < entries.length - 1) {
				setFocusIndex((prev) => Math.min(entries.length - 1, prev + 1));
			}
			if (key.return && entries[focusIndex]) {
				handleSelect(entries[focusIndex]);
			}
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

	// Detail view
	if (selectedEntry && detailContent) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " ", selectedEntry.title),
			detailContent.frontmatter && Object.keys(detailContent.frontmatter).length > 0
				? React.createElement(
						Box,
						{ flexDirection: "column", marginY: 1 },
						...Object.entries(detailContent.frontmatter).map(([k, v]) =>
							React.createElement(
								Text,
								{ key: k, color: "gray" },
								" ",
								k,
								": ",
								String(v),
							),
						),
					)
				: null,
			React.createElement(
				Box,
				{ flexDirection: "column", marginY: 1, borderStyle: "single", borderColor: "gray" },
				React.createElement(
					Text,
					null,
					detailContent.body || React.createElement(Text, { color: "gray" }, " (empty)"),
				),
			),
			React.createElement(Text, { color: "gray" }, " Escape to close"),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Memory"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter view, Escape back"),
		entries.length === 0
			? React.createElement(Text, { color: "gray" }, " No memory entries.")
			: entries.map((entry, i) => {
					const isSelected = focusIndex === i;
					const dateStr = entry.mtime.toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					});
					return React.createElement(
						Box,
						{
							key: entry.fileName,
							flexDirection: "row",
							borderColor: isSelected ? "cyan" : "transparent",
						},
						React.createElement(
							Text,
							null,
							isSelected ? "▸ " : "  ",
							entry.title,
							" ",
							React.createElement(Text, { color: "gray" }, dateStr),
						),
					);
				}),
	);
}
