import React, { useRef, useEffect } from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView } from "ink-scroll-view";
import { getRoleLabel } from "./messages.js";
import { MarkdownText } from "./markdownText.js";

/**
 * Cached Intl.DateTimeFormat for system-localized time display.
 * Uses the runtime's default locale with numeric hour and 2-digit minute.
 */
const timeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "numeric",
	minute: "2-digit",
});

/**
 * Format a Date as a locale-aware time string using the cached formatter.
 * @param {Date} date - The date to format
 * @returns {string} Localized time string
 */
export function formatTime(date) {
	return timeFormatter.format(date);
}

/**
 * Get color for a message role.
 * @param {string} role
 * @returns {{ label: string, content: string }}
 */
export function getRoleColors(role) {
	const cache = getRoleColors._cache || (getRoleColors._cache = new Map());
	if (!cache.has(role)) {
		if (role === "user") {
			cache.set(role, { label: "green", content: "white" });
		} else if (role === "system") {
			cache.set(role, { label: "yellow", content: "yellow" });
		} else {
			cache.set(role, { label: "cyan", content: "white" });
		}
	}
	return cache.get(role);
}

/**
 * Get bubble layout props (alignment + colors) for a message role.
 * @param {string} role
 * @returns {{ alignment: "flex-start" | "flex-end", border: string }}
 */
export function getBubbleStyle(role) {
	const cache = getBubbleStyle._cache || (getBubbleStyle._cache = new Map());
	if (!cache.has(role)) {
		if (role === "user") {
			cache.set(role, { alignment: "flex-end", border: "green" });
		} else if (role === "system") {
			cache.set(role, { alignment: "flex-start", border: "yellow" });
		} else {
			cache.set(role, { alignment: "flex-start", border: "cyan" });
		}
	}
	return cache.get(role);
}

/**
 * Memoized message bubble component.
 * Skips re-render when display-relevant message fields haven't changed.
 * Compares: role, content, time, reasoningContent, streaming,
 * activeToolCall, toolCallDisplay, and a stable message identifier.
 * @param {object} props
 * @param {Message} props.msg - The message data object
 * @param {string} props.assistantName - Name to display for assistant
 * @returns {React.ReactElement}
 */
const MessageBubble = React.memo(
	function MessageBubble({ msg, assistantName }) {
		const time = msg.time || formatTime(new Date());
		const colors = getRoleColors(msg.role);
		const bubble = getBubbleStyle(msg.role);

		const content = msg.content || "";
		const hasReasoning = msg.role === "assistant" && msg.reasoningContent;
		const hasActiveToolCall = msg.role === "assistant" && msg.activeToolCall;
		const hasToolCallDisplay = msg.role === "assistant" && msg.toolCallDisplay;

		const reasoningEl = hasReasoning
			? React.createElement(
					Box,
					{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
					React.createElement(
						Text,
						{ dimColor: true, color: "gray" },
						`(thinking) ` +
							(msg.reasoningContent || "").slice(0, 200) +
							(msg.reasoningContent && msg.reasoningContent.length > 200
								? "\u00b7\u00b7\u00b7"
								: ""),
					),
				)
			: null;

		const toolCallEl = hasActiveToolCall
			? React.createElement(
					Box,
					{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
					React.createElement(
						Text,
						{ dimColor: true, color: "gray" },
						`- Running: ${msg.activeToolCall.name} \u00b7\u00b7\u00b7`,
					),
				)
			: null;

		const toolDisplayEl = hasToolCallDisplay
			? React.createElement(
					Box,
					{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
					...msg.toolCallDisplay
						.split("\n")
						.map((line, j) =>
							React.createElement(
								Text,
								{ key: "tool-" + j, dimColor: true, color: "gray" },
								"  " + line,
							),
						),
				)
			: null;

		return React.createElement(
			Box,
			{
				key: "msg-" + msg.id,
				flexDirection: "row",
				paddingY: 0,
				justifyContent: bubble.alignment,
			},
			React.createElement(
				Box,
				{
					key: "bubble-" + msg.id,
					flexDirection: "column",
					paddingX: 1,
					borderColor: bubble.border,
					borderStyle: "round",
					maxWidth: "90%",
				},
				React.createElement(
					Box,
					{ flexDirection: "row" },
					React.createElement(Text, { color: "gray" }, "[" + time + "] "),
					React.createElement(
						Text,
						{ color: colors.label, bold: true },
						getRoleLabel(msg.role, assistantName) + ": ",
					),
				),
				React.createElement(
					Box,
					{ flexDirection: "column" },
					React.createElement(
						Box,
						{ flexDirection: "row" },
						React.createElement(MarkdownText, { content }),
					),
					reasoningEl,
					toolCallEl,
					toolDisplayEl,
				),
			),
		);
	},
	function areEqual(prevProps, nextProps) {
		const p = prevProps.msg;
		const n = nextProps.msg;
		return (
			p.role === n.role &&
			p.content === n.content &&
			p.time === n.time &&
			p.reasoningContent === n.reasoningContent &&
			p.streaming === n.streaming &&
			p.toolCallDisplay === n.toolCallDisplay &&
			p.activeToolCall === n.activeToolCall &&
			p.id === n.id
		);
	},
);

/**
 * Render the conversation message loop for a given messages array.
 * Returns React elements for each message bubble.
 * Uses memoized MessageBubble components to skip re-render of unchanged rows.
 * @param {Array} messages - The messages to render
 * @param {string} assistantName - Name to display for assistant messages
 * @returns {Array} React elements
 */
export function renderMessages(messages, assistantName) {
	const children = [];

	for (let i = 0; i < (messages?.length ?? 0); i++) {
		const msg = messages[i];
		const rowKey = "msg-" + i;

		children.push(
			React.createElement(MessageBubble, {
				key: rowKey,
				msg: { ...msg, id: msg.id ?? i },
				assistantName,
			}),
		);
	}

	if (messages.length === 0) {
		children.push(
			React.createElement(
				Text,
				{ key: "empty", color: "gray" },
				" No messages yet. Start chatting!",
			),
		);
	}

	return children;
}

/**
 * Conversation panel component with ScrollView-based scrolling.
 * Handles keyboard scroll input, terminal resize remeasurement,
 * and auto-scroll-to-bottom on new messages and streaming overflow.
 * @param {Object} props
 * @param {Array} props.messages - Messages to display
 * @param {string} props.assistantName - Name for assistant messages
 * @param {React.Ref} [props.scrollRef] - Optional external scroll ref
 */
export function ConversationPanel({
	messages = [],
	assistantName = "Assistant",
	scrollRef: externalScrollRef,
}) {
	// Default to empty array for both null and undefined
	messages = messages || [];

	const internalScrollRef = useRef(null);
	const scrollRef = externalScrollRef || internalScrollRef;
	const previousMessageCount = useRef(0);
	const { stdout } = useStdout();

	// Handle terminal resize by remeasuring content heights
	useEffect(() => {
		const resizeHandler = () => {
			if (scrollRef.current && stdout.isTTY && !process.env.CI) {
				scrollRef.current.remeasure();
			}
		};
		stdout.on("resize", resizeHandler);
		return () => {
			stdout.off("resize", resizeHandler);
		};
	}, [stdout, scrollRef]);

	// Auto-scroll to bottom when new messages arrive or streaming content overflows.
	// Guarded by interactive mode detection to prevent issues in non-interactive contexts.
	useEffect(() => {
		if (!scrollRef.current) return;
		const isInteractive = stdout.isTTY && !process.env.CI;
		if (!isInteractive) return;

		const lastMsg = messages[messages.length - 1];
		const contentH = scrollRef.current.getContentHeight();
		const viewportH = scrollRef.current.getViewportHeight();

		if (messages.length > previousMessageCount.current) {
			// Re-measure before scrolling to ensure content heights are up to date.
			// This prevents a race condition where scrollToBottom fires before
			// the ScrollView has finished measuring newly added children.
			scrollRef.current.remeasure();
			scrollRef.current.scrollToBottom();
			previousMessageCount.current = messages.length;
		} else if (lastMsg?.streaming && contentH && viewportH && contentH > viewportH) {
			scrollRef.current.remeasure();
			scrollRef.current.scrollToBottom();
		}
	}, [messages.length, stdout.isTTY]);

	const children = React.useMemo(
		() => renderMessages(messages, assistantName),
		[messages, assistantName],
	);

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(ScrollView, { ref: scrollRef, key: "scroll", focus: false }, ...children),
	);
}
