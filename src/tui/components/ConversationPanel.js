/**
 * ConversationPanel — ScrollView-based message display.
 */
import React, { useRef, useEffect } from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView } from "ink-scroll-view";
import { getRoleLabel } from "../components/messages.js";
import { MarkdownText } from "../utils/markdownText.js";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "numeric",
	minute: "2-digit",
});

export function formatTime(date) {
	return timeFormatter.format(date);
}

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

export function ConversationPanel({
	messages = [],
	assistantName = "Assistant",
	scrollRef: externalScrollRef,
}) {
	messages = messages || [];

	const internalScrollRef = useRef(null);
	const scrollRef = externalScrollRef || internalScrollRef;
	const previousMessageCount = useRef(0);
	const previousContentHashRef = useRef(0);
	const { stdout } = useStdout();

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

	useEffect(() => {
		if (!scrollRef.current) return;

		const lastMsg = messages[messages.length - 1];
		const streamingContentLen = lastMsg?.streaming ? (lastMsg.content || "").length : 0;
		const contentHash = messages.length + streamingContentLen;

		const shouldScroll =
			messages.length > previousMessageCount.current ||
			(lastMsg?.streaming && contentHash !== previousContentHashRef.current);

		if (shouldScroll) {
			scrollRef.current.remeasure();

			const scrollHandle = () => {
				if (scrollRef.current) {
					scrollRef.current.scrollToBottom();
					previousMessageCount.current = messages.length;
				}
			};
			const timer = setTimeout(scrollHandle, 0);
			return () => clearTimeout(timer);
		}

		previousContentHashRef.current = contentHash;
	}, [messages, stdout.isTTY]);

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
