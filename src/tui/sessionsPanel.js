import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";
import { loadSession } from "../session/loader.js";

/**
 * SessionsPanel — browse and resume past sessions.
 * Props:
 *   sessionState  - SessionStateManager instance
 *   config        - App config (for memory.sessionsDir)
 *   onViewChange  - Callback to switch back to conversation view
 *   isActive      - Whether this panel is the active input target
 */
export function SessionsPanel({ sessionState, config, onViewChange, isActive = false }) {
	const [sessions, setSessions] = useState([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [resuming, setResuming] = useState(null);

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
						try {
							const exchanges = JSON.parse(body);
							if (Array.isArray(exchanges)) {
								const firstUser = exchanges.find((e) => e.role === "user");
								if (firstUser?.content) {
									topic = firstUser.content
										.replace(/[\n\r]+/g, " ")
										.replace(/\s+/g, " ")
										.trim()
										.slice(0, 80);
								}
							}
						} catch (_e) {
							// Body is not JSON — leave topic empty
						}

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

	useInput(
		(input, key) => {
			if (key.upArrow && focusIndex > 0) {
				setFocusIndex((prev) => Math.max(0, prev - 1));
			}
			if (key.downArrow && focusIndex < sessions.length - 1) {
				setFocusIndex((prev) => Math.min(sessions.length - 1, prev + 1));
			}
			if (key.return && sessions[focusIndex]) {
				handleResume(sessions[focusIndex].sessionId);
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

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1, flexGrow: 1 },
		React.createElement(Text, { bold: true, color: "cyan" }, " Sessions"),
		React.createElement(Text, { color: "gray" }, " ↑↓ navigate, Enter resume, Escape back"),
		sessions.length === 0
			? React.createElement(Text, { color: "gray" }, " No saved sessions.")
			: sessions.map((entry, i) => {
					const isSelected = focusIndex === i;
					const isResumingThis = resuming === entry.sessionId;
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
					return React.createElement(
						Box,
						{
							key: entry.sessionId,
							flexDirection: "row",
							borderColor: isSelected ? "cyan" : "transparent",
						},
						React.createElement(
							Text,
							null,
							isSelected ? "▸ " : "  ",
							isResumingThis ? "⟳ " : "",
							entry.sessionId.slice(0, 8),
							"... ",
							React.createElement(
								Text,
								{ color: "gray" },
								msgLabel,
								" ",
								startStr ? `${startStr} → ` : "",
								dateStr,
							),
							entry.topic ? React.createElement(Text, null, " ", entry.topic) : null,
						),
					);
				}),
	);
}
