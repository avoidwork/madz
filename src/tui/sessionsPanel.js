import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import SelectInput from "ink-select-input";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";
import { loadSession } from "../session/loader.js";

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
 * SessionsPanel — browse and resume past sessions.
 * Props:
 *   sessionState  - SessionStateManager instance
 *   config        - App config (for memory.sessionsDir)
 *   onViewChange  - Callback to switch back to conversation view
 *   activeView  - The current active view name (from PANELS)
 */
export function SessionsPanel({ sessionState, config, onViewChange, activeView }) {
	const isActive = activeView === "sessions";
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [resuming, setResuming] = useState(null);
	const { rows } = useWindowSize();
	// Bound the visible list to the terminal height minus header rows.
	const limit = Math.max(1, rows - 4);

	// Async load session list
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const sessionsDir = config?.memory?.sessionsDir || "memory/sessions/";
				const cwd = config?.cwd || process.cwd();
				const dir = join(cwd, sessionsDir);
				let files;
				try {
					files = await readdir(dir);
				} catch (_err) {
					setSessions([]);
					setLoading(false);
					return;
				}
				const mdFiles = files.filter((f) => f.endsWith(".md"));
				const entries = [];
				for (const file of mdFiles) {
					try {
						const filepath = join(dir, file);
						const st = await stat(filepath);
						const content = await readFile(filepath, "utf-8");
						const { frontmatter, content: body } = parseFrontmatter(content);
						const sessionId = file.replace(/\.md$/, "");

						// Synthesize a topic from the first user message
						let topic = "";
						let isCronJob = false;
						try {
							const exchanges = JSON.parse(body);
							if (Array.isArray(exchanges)) {
								const firstUser = exchanges.find((e) => e.role === "user");
								if (firstUser?.content) {
									const msg = firstUser.content;
									topic = msg
										.replace(/[\n\r]+/g, " ")
										.replace(/\s+/g, " ")
										.trim()
										.slice(0, 80);

									// Filter out cron-triggered skill executions
									isCronJob = /^run the .+ skill/i.test(msg.trim());
								}
							}
						} catch (_e) {
							// Body is not JSON — leave topic empty
						}

						// Skip cron job sessions
						if (isCronJob) continue;

						entries.push({
							sessionId,
							fileName: file,
							mtime: st.mtime,
							size: st.size,
							messageCount: frontmatter.messageCount ?? 0,
							startedAt: frontmatter.startedAt || null,
							endedAt: frontmatter.endedAt || null,
							topic,
						});
					} catch (_err) {
						// skip unreadable files
					}
				}
				// Sort by endedAt descending (most recent first), fallback to mtime
				entries.sort((a, b) => {
					const aTime = a.endedAt ? new Date(a.endedAt).getTime() : a.mtime.getTime();
					const bTime = b.endedAt ? new Date(b.endedAt).getTime() : b.mtime.getTime();
					return bTime - aTime;
				});
				if (!cancelled) {
					setSessions(entries);
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
	}, [config?.memory?.sessionsDir, config?.cwd]);

	const handleResume = useCallback(
		async (sessionId) => {
			if (!sessionState || !sessionId) return;
			setResuming(sessionId);
			try {
				const sessionsDir = config?.memory?.sessionsDir || "memory/sessions/";
				const cwd = config?.cwd || process.cwd();
				const loaded = await loadSession(sessionsDir, 20, sessionId, cwd);
				if (!loaded || !loaded.conversation) {
					setResuming(null);
					return;
				}
				// Resume: createNewSession → loadConversation → setSessionId
				sessionState.createNewSession(sessionId);
				sessionState.loadConversation(loaded.conversation);
				sessionState.setSessionId(sessionId);
				// Navigate back to conversation view
				onViewChange?.("conversation");
			} catch (err) {
				setError(`Failed to resume session: ${err.message}`);
				setResuming(null);
			}
		},
		[sessionState, config, onViewChange],
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

	if (loading) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Sessions"),
			React.createElement(Text, { color: "gray" }, " Loading sessions..."),
		);
	}

	if (error) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Sessions"),
			React.createElement(Text, { color: "red" }, ` Error: ${error}`),
		);
	}

	if (sessions.length === 0) {
		return React.createElement(
			Box,
			{ flexDirection: "column", paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, " Sessions"),
			React.createElement(Text, { color: "gray" }, " No saved sessions."),
		);
	}

	const items = sessions.map((entry) => {
		const dateStr = entry.endedAt
			? new Date(entry.endedAt).toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})
			: entry.mtime.toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				});
		const msgLabel = entry.messageCount === 1 ? "1 msg" : `${entry.messageCount} msgs`;
		const startStr = entry.startedAt
			? new Date(entry.startedAt).toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})
			: "";
		const isResumingThis = resuming === entry.sessionId;
		const label = `${isResumingThis ? "⟳ " : ""}${entry.sessionId.slice(0, 8)}...  ${msgLabel}  ${
			startStr ? `${startStr} → ` : ""
		}${dateStr}${entry.topic ? `  ${entry.topic}` : ""}`;
		return {
			label,
			value: entry,
			key: entry.sessionId,
		};
	});

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Sessions"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter resume, Escape back"),
		React.createElement(SelectInput, {
			items,
			isFocused: isActive,
			limit,
			indicatorComponent: CyanIndicator,
			itemComponent: CyanItem,
			onSelect: (item) => handleResume(item.value.sessionId),
		}),
	);
}
