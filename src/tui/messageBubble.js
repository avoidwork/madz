import React, { useState, useImperativeHandle, forwardRef } from "react";
import { Box, Text } from "ink";
import { getRoleLabel } from "./messages.js";
import { MarkdownText } from "./markdownText.js";
import { getRoleColors, getBubbleStyle, formatTime } from "./conversationPanel.js";

/**
 * A single message bubble component that manages its own state.
 * Receives initial props then updates itself via the exposed update() method.
 * @param {Object} props
 * @param {string} props.role - Message role: "user" | "assistant" | "system"
 * @param {string} props.content - Message content text
 * @param {string} [props.time] - Timestamp string (HH:MM)
 * @param {string} props.assistantName - Name to display for assistant messages
 * @param {string} [props.reasoningContent] - Thinking/thought content
 * @param {Object} [props.activeToolCall] - {name: string} for running tool
 * @param {string} [props.toolCallDisplay] - Tool call result display text
 * @param {boolean} [props.streaming] - Whether message is currently streaming
 * @param {string} [props.cursorChar] - The cursor character to display (default: █)
 * @returns {React.ReactElement}
 */
const MessageBubbleInner = forwardRef(function MessageBubbleInner(
	{
		role,
		content,
		time,
		assistantName,
		reasoningContent,
		activeToolCall,
		toolCallDisplay,
		cursorChar,
	},
	ref,
) {
	const [internalContent, setInternalContent] = useState(content || "");
	const [internalStreaming, setInternalStreaming] = useState(false);
	const [internalReasoningContent, setInternalReasoningContent] = useState(reasoningContent);
	const [internalActiveToolCall, setInternalActiveToolCall] = useState(activeToolCall);
	const [internalToolCallDisplay, setInternalToolCallDisplay] = useState(toolCallDisplay);

	// Expose imperative update method for streaming/content updates
	useImperativeHandle(ref, () => ({
		update(updates) {
			if (updates.content !== undefined) setInternalContent(updates.content);
			if (updates.streaming !== undefined) setInternalStreaming(updates.streaming);
			if (updates.reasoningContent !== undefined)
				setInternalReasoningContent(updates.reasoningContent);
			if (updates.activeToolCall !== undefined) setInternalActiveToolCall(updates.activeToolCall);
			if (updates.toolCallDisplay !== undefined)
				setInternalToolCallDisplay(updates.toolCallDisplay);
		},
	}));

	const displayContent = internalContent || "";
	const displayStreaming = internalStreaming;

	const ts = time || formatTime(new Date());
	const colors = getRoleColors(role);
	const bubble = getBubbleStyle(role);

	const cChar = cursorChar || "\u2588";
	const renderContent =
		displayStreaming && displayContent ? displayContent + cChar : displayContent;

	const hasReasoning = role === "assistant" && internalReasoningContent;
	const hasActiveToolCall = role === "assistant" && internalActiveToolCall;
	const hasToolCallDisplay = role === "assistant" && internalToolCallDisplay;

	const reasoningEl = hasReasoning
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(
					Text,
					{ dimColor: true, color: "gray" },
					`(thinking) ` +
						internalReasoningContent.slice(0, 200) +
						(internalReasoningContent.length > 200 ? "\u00b7\u00b7\u00b7" : ""),
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
					`- Running: ${internalActiveToolCall.name} \u00b7\u00b7\u00b7`,
				),
			)
		: null;

	const toolDisplayEl = hasToolCallDisplay
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				...internalToolCallDisplay
					.split("\n")
					.map((line, j) =>
						React.createElement(Text, { key: `tool-${j}`, color: "gray" }, `  ${line}`),
					),
			)
		: null;

	return React.createElement(
		Box,
		{
			key: `bubble-${role}`,
			flexDirection: "row",
			paddingY: 0,
			justifyContent: bubble.alignment,
			gap: 0,
		},
		React.createElement(
			Box,
			{
				key: `bubble-inner-${role}`,
				flexDirection: "column",
				paddingX: 1,
				borderColor: bubble.border,
				borderStyle: "round",
				maxWidth: "90%",
				gap: 0,
			},
			React.createElement(
				Box,
				{ flexDirection: "row" },
				React.createElement(Text, { color: "gray" }, `[${ts}] `),
				React.createElement(
					Text,
					{ color: colors.label, bold: true },
					`${getRoleLabel(role, assistantName)}: `,
				),
			),
			React.createElement(
				Box,
				{ flexDirection: "row" },
				React.createElement(MarkdownText, {
					content: renderContent,
				}),
			),
			reasoningEl,
			toolCallEl,
			toolDisplayEl,
		),
	);
});

// Use a memo-wrapped version for efficient re-renders
const MessageBubble = React.memo(MessageBubbleInner);

export { MessageBubble };
