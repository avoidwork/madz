import React, { useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { MessageBubble } from "./messageBubble.js";
import { getRoleLabel } from "./messages.js";

/**
 * Subagents panel — renders each subagent's reasoning/message segments and
 * tool calls captured during a multi-agent turn.
 *
 * The orchestrator's `callProvider` emits `subagent_*` events carrying a
 * stream namespace (e.g. `["task:<uuid>"]`). `createStreamingHandler` routes
 * those events into a subagent store keyed by namespace. This panel reads that
 * store and renders each subagent as a distinct block, reusing `MessageBubble`
 * to render the reasoning/message segments and a compact tool-call list.
 *
 * Props:
 *   subagentStore      - Object keyed by namespace string, each value being
 *                        `{ namespace, segments, toolCalls }`.
 *   activeView         - The current active view name (from PANELS).
 *   onViewChange       - Callback to switch back to conversation view.
 *   reasoningCollapsed - Whether reasoning segments render collapsed (global
 *                        ctrl+r toggle, shared with the conversation view).
 *   toolCallCollapsed  - Whether tool segments render collapsed (global
 *                        ctrl+t toggle, shared with the conversation view).
 */
export function SubagentsPanel({
	subagentStore = {},
	activeView,
	onViewChange,
	reasoningCollapsed = false,
	toolCallCollapsed = true,
}) {
	const isActive = activeView === "subagents";
	const { rows } = useWindowSize();
	const limit = Math.max(1, rows - 4);

	const entries = useMemo(() => {
		return Object.values(subagentStore || {});
	}, [subagentStore]);

	// Escape returns to conversation view
	useInput(
		(_input, key) => {
			if (key.escape) {
				onViewChange?.("conversation");
			}
		},
		{ isActive },
	);

	if (!isActive) {
		return React.createElement(Box, null);
	}

	if (entries.length === 0) {
		return React.createElement(
			Box,
			{ flexDirection: "column", padding: 1 },
			React.createElement(Text, { color: "gray" }, "No subagent activity yet."),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", padding: 1 },
		React.createElement(Text, { bold: true }, `Subagents (${entries.length})`),
		...entries.slice(0, limit).map((entry) =>
			React.createElement(
				Box,
				{ key: entry.namespace, flexDirection: "column", marginBottom: 1 },
				React.createElement(
					Text,
					{ color: "cyan", bold: true },
					`▸ ${getRoleLabel("assistant", entry.namespace)}`,
				),
				React.createElement(MessageBubble, {
					role: "assistant",
					content: (entry.segments || []).map((s) => s.content).join(""),
					segments: entry.segments,
					streaming: false,
					assistantName: entry.namespace,
					reasoningCollapsed,
					toolCallCollapsed,
				}),
				renderToolCalls(entry.toolCalls),
			),
		),
	);
}

/**
 * Render a subagent's tool calls as a compact list.
 * @param {Array<Object>} toolCalls - The subagent's tool call entries.
 * @returns {React.ReactElement|null} The rendered tool-call list, or null.
 */
function renderToolCalls(toolCalls) {
	if (!toolCalls || toolCalls.length === 0) return null;

	return React.createElement(
		Box,
		{ flexDirection: "column", marginTop: 1 },
		React.createElement(Text, { color: "yellow", bold: true }, "Tool calls:"),
		...toolCalls.map((call, idx) =>
			React.createElement(
				Text,
				{ key: idx, color: call.status === "error" ? "red" : "gray" },
				`  • ${call.name}${call.status === "running" ? " (running)" : ""}`,
			),
		),
	);
}
