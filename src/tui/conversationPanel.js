import React, { useRef, useEffect } from "react";
import { Box, Text } from "ink";
import { MessageList } from "./messageList.js";
import { getRoleLabel } from "./messages.js";
import { MarkdownText } from "./markdownText.js";

// Make these available to the memo-wrapped bubble (legacy compat).
const _gl = getRoleLabel;
const _mdt = MarkdownText;

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
 * Get color for a message role (cached).
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
 * Get bubble layout props (alignment + colors) for a message role (cached).
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
					React.createElement(Text, { color: "gray" }, `[${time}] `),
					React.createElement(
						Text,
						{ color: colors.label, bold: true },
						`${_gl(msg.role, assistantName)}: `,
					),
				),
				React.createElement(
					Box,
					{ flexDirection: "column" },
					React.createElement(
						Box,
						{ flexDirection: "row" },
						React.createElement(_mdt, {
							content,
						}),
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
 * Limits rendering to the last maxMessages messages.
 * @param {Array} messages - The messages to render
 * @param {string} assistantName - Name to display for assistant messages
 * @param {number} [maxMessages] - Maximum number of messages to render (default: all)
 * @returns {Array} React elements
 */
export function renderMessages(messages, assistantName, maxMessages = Infinity) {
	const children = [];
	const startIdx = Math.max(0, (messages?.length ?? 0) - maxMessages);

	for (let i = startIdx; i < (messages?.length ?? 0); i++) {
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

	if (children.length === 0) {
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
 * Conversation panel component — thin wrapper delegating to MessageList.
 * Supports two modes: legacy (messages prop for session restore) and
 * component-based (messageListRef for imperative updates).
 * In component-based mode, MessageList is populated from initial messages
 * and all subsequent updates happen via the ref imperatively.
 * @param {Object} props
 * @param {Array} [props.messages] - Messages to display (for session restore)
 * @param {string} [props.assistantName] - Name for assistant messages
 * @param {React.Ref} [props.scrollRef] - Optional external scroll ref
 * @param {React.Ref} [props.messageListRef] - Optional ref for imperative access
 * @returns {React.ReactElement}
 */
export function ConversationPanel({
	messages = [],
	assistantName = "Assistant",
	scrollRef: externalScrollRef,
	messageListRef,
}) {
	const internalListRef = useRef(null);
	const panelRef = messageListRef || internalListRef;

	// Initialize MessageList from messages data on first mount / session restore
	useEffect(() => {
		if (panelRef.current && messages?.length > 0) {
			panelRef.current.setMessages(messages);
		}
	}, []); // Only on mount — messages change not needed

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(MessageList, {
			ref: panelRef,
			assistantName,
			scrollRef: externalScrollRef,
		}),
	);
}
