/**
 * MessageBubble component — a standalone message bubble that manages its own state.
 * Each bubble is a React component instance with its own useState hooks,
 * allowing independent updates without re-rendering other bubbles.
 *
 * Exposes an imperative `update()` method via useImperativeHandle for
 * streaming handlers to call directly during message streaming.
 *
 * @module messageBubble
 */

import React, { useState, useImperativeHandle, forwardRef, memo } from "react";
import { Box, Text } from "ink";
import { getRoleLabel, formatMessage, isStreamingMessage, countMessageLines, getToolCallLines } from "./messages.js";
import { getRoleColors, getBubbleStyle, formatTime } from "./conversationPanel.js";
import { MarkdownText } from "./markdownText.js";

/**
 * Maximum length for reasoning content display truncation.
 * @constant {number}
 */
const REASONING_MAX_LENGTH = 200;

/**
 * MessageBubble component props.
 * @typedef {Object} MessageBubbleProps
 * @property {string} role - Message role: "user", "assistant", or "system"
 * @property {string} content - Initial message content
 * @property {string} [assistantName] - Name to display for assistant
 * @property {string} [time] - Timestamp string (HH:MM format)
 */

/**
 * MessageBubble component — manages its own state for content, streaming,
 * tool calls, and reasoning content. Updates independently via the exposed
 * `update()` method.
 *
 * @param {MessageBubbleProps} props - Component props
 * @param {React.Ref} ref - Ref to expose the update method
 * @returns {React.ReactElement}
 */
const MessageBubble = forwardRef(function MessageBubble(
	{ role, content: initialContent, assistantName, time: initialTime },
	ref,
) {
	const [content, setContent] = useState(initialContent || "");
	const [streaming, setStreaming] = useState(false);
	const [toolCallDisplay, setToolCallDisplay] = useState("");
	const [reasoningContent, setReasoningContent] = useState("");
	const [activeToolCall, setActiveToolCall] = useState(null);
	const [time] = useState(initialTime || formatTime(new Date()));

	/**
	 * Update the bubble's state with new values.
	 * Called by streaming handlers during message streaming.
	 *
	 * @param {Object} updates - State updates to apply
	 * @param {string} [updates.content] - New content text
	 * @param {boolean} [updates.streaming] - Streaming state
	 * @param {string} [updates.toolCallDisplay] - Tool call display text
	 * @param {string} [updates.reasoningContent] - Reasoning/thinking content
	 * @param {Object} [updates.activeToolCall] - Active tool call {name: string}
	 */
	useImperativeHandle(
		ref,
		() => ({
			update: (updates) => {
				if (updates.content !== undefined) setContent(updates.content);
				if (updates.streaming !== undefined) setStreaming(updates.streaming);
				if (updates.toolCallDisplay !== undefined) setToolCallDisplay(updates.toolCallDisplay);
				if (updates.reasoningContent !== undefined) setReasoningContent(updates.reasoningContent);
				if (updates.activeToolCall !== undefined) setActiveToolCall(updates.activeToolCall);
			},
		}),
		[],
	);

	const colors = getRoleColors(role);
	const bubble = getBubbleStyle(role);

	const hasReasoning = role === "assistant" && reasoningContent;
	const hasActiveToolCall = role === "assistant" && activeToolCall;
	const hasToolCallDisplay = role === "assistant" && toolCallDisplay;

	const reasoningEl = hasReasoning
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(
					Text,
					{ dimColor: true, color: "gray" },
					`(thinking) ` +
						reasoningContent.slice(0, REASONING_MAX_LENGTH) +
						(reasoningContent.length > REASONING_MAX_LENGTH ? "..." : ""),
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
					`- Running: ${activeToolCall.name} ...`,
				),
			)
		: null;

	const toolDisplayEl = hasToolCallDisplay
		? React.createElement(
				Box,
				{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
				...toolCallDisplay
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
			key: "msg-bubble-" + role + "-" + time,
			flexDirection: "row",
			paddingY: 0,
			justifyContent: bubble.alignment,
		},
		React.createElement(
			Box,
			{
				key: "bubble-inner-" + role + "-" + time,
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
					getRoleLabel(role, assistantName) + ": ",
				),
			),
			React.createElement(
				Box,
				{ flexDirection: "column" },
				React.createElement(
					Box,
					{ flexDirection: "row" },
					React.createElement(MarkdownText, { content: content + (streaming ? "\u2588" : "") }),
				),
				reasoningEl,
				toolCallEl,
				toolDisplayEl,
			),
		),
	);
});

export default memo(MessageBubble);