import React, { useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { MessageBubble } from "./messageBubble.js";
import { VirtualScrollView } from "./scrollView.js";

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
 * The panel virtualizes the subagent list via `VirtualScrollView` and
 * auto-scrolls to the bottom as new subagent output arrives, so the user can
 * track live subagent activity. Manual scroll-up suppresses auto-scroll until
 * the user returns to the bottom.
 *
 * Props:
 *   subagentStore      - Object keyed by namespace string, each value being
 *                        `{ namespace, segments, toolCalls }`.
 *   activeView         - The current active view name (from PANELS).
 *   onViewChange       - Callback to switch back to conversation view.
 *
 * This is a read-only view: it always renders the message bubbles expanded
 * (reasoning and tool content visible). It does not participate in the global
 * ctrl+r / ctrl+t collapse toggles, which apply only to the conversation view.
 */
export const SubagentsPanel = forwardRef(function SubagentsPanel(
	{
		subagentStore = {},
		activeView,
		onViewChange,
	},
	ref,
) {
	const isActive = activeView === "subagents";
	const { rows } = useWindowSize();
	const scrollRef = useRef(null);
	// Track manual scroll-up: when the user scrolls away from the bottom,
	// suppress auto-scroll until they return to the bottom.
	const isUserScrolledUpRef = useRef(false);

	// VirtualScrollView keys items by `id` (used for the height map and React
	// keys). Map each store entry to an object carrying its namespace as the id.
	const entries = useMemo(() => {
		return Object.values(subagentStore || {}).map((entry) => ({
			id: entry.namespace,
			...entry,
		}));
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

	// Auto-scroll to the bottom when content grows, unless the user has scrolled
	// up to read earlier output.
	const handleContentHeightChange = useCallback((height, previousHeight) => {
		if (!scrollRef.current || height <= previousHeight) return;
		if (isUserScrolledUpRef.current) return;
		scrollRef.current.scrollToBottom?.();
	}, []);

	// Track manual scroll position; resume auto-scroll when the user returns
	// to the bottom.
	const handleScroll = useCallback((offset) => {
		const bottom = scrollRef.current?.getBottomOffset?.() || 0;
		isUserScrolledUpRef.current = offset < bottom;
	}, []);

	// Expose imperative scroll API so the app-level scroll keys (up/down/page)
	// and the ctrl+r/ctrl+t scroll-to-bottom can route to this panel.
	useImperativeHandle(
		ref,
		() => ({
			scrollToBottom: () => scrollRef.current?.scrollToBottom?.(),
			scrollBy: (delta) => scrollRef.current?.scrollBy?.(delta),
			scrollToTop: () => scrollRef.current?.scrollToTop?.(),
			getViewportHeight: () => scrollRef.current?.getViewportHeight?.(),
			getBottomOffset: () => scrollRef.current?.getBottomOffset?.(),
		}),
		[],
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

	const viewportHeight = Math.max(1, rows - 4);

	return React.createElement(
		Box,
		{ flexDirection: "column", padding: 1 },
		React.createElement(VirtualScrollView, {
			ref: scrollRef,
			items: entries,
			height: viewportHeight,
			overscan: 2,
			estimateHeight: (entry) => estimateSubagentHeight(entry),
			renderItem: (entry) =>
				React.createElement(
					Box,
					{ flexDirection: "column", marginBottom: 1 },
					React.createElement(MessageBubble, {
						role: "assistant",
						content: (entry.segments || []).map((s) => s.content).join(""),
						segments: entry.segments,
						streaming: false,
						assistantName: "subagent",
						// Read-only view — always render expanded. The subagents
						// panel does not participate in the global collapse toggles.
						reasoningCollapsed: false,
						toolCallCollapsed: false,
					}),
					renderToolCalls(entry.toolCalls),
				),
			onContentHeightChange: handleContentHeightChange,
			onScroll: handleScroll,
		}),
	);
});

/**
 * Estimate the rendered height of a subagent entry in rows, used by the
 * virtualized scroll view for off-window items. The measured height corrects
 * lazily as items scroll into view.
 * @param {{segments?: Array<{type: string, content: string}>, toolCalls?: Array<Object>}} entry
 * @returns {number} Estimated height in rows.
 */
export function estimateSubagentHeight(entry) {
	// Header row + message content lines + tool-call rows.
	let height = 1;
	const text = (entry.segments || []).map((s) => s.content).join("");
	if (text) height += Math.ceil(text.length / 80) || 1;
	// Each tool call renders as a row in the compact list.
	height += (entry.toolCalls || []).length;
	return Math.max(1, height);
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
		...toolCalls.map((call, idx) =>
			React.createElement(
				Text,
				{ key: idx, color: call.status === "error" ? "red" : "gray" },
				`🔧 ${call.name}${call.status === "running" ? " (running)" : ""}`,
			),
		),
	);
}
