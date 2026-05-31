import React, { useRef, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
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
	if (role === "user") {
		return { label: "green", content: "white" };
	}
	if (role === "system") {
		return { label: "yellow", content: "yellow" };
	}
	return { label: "cyan", content: "white" };
}

/**
 * Get bubble layout props (alignment + colors) for a message role.
 * @param {string} role
 * @returns {{ alignment: "flex-start" | "flex-end", border: string }}
 */
export function getBubbleStyle(role) {
	if (role === "user") {
		return { alignment: "flex-end", border: "green" };
	}
	if (role === "system") {
		return { alignment: "flex-start", border: "yellow" };
	}
	return { alignment: "flex-start", border: "cyan" };
}

/**
 * Render the conversation message loop for a given messages array.
 * Returns React elements for each message bubble.
 * @param {Array} messages - The messages to render
 * @param {string} assistantName - Name to display for assistant messages
 * @returns {Array} React elements
 */
export function renderMessages(messages, assistantName) {
	const children = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		const time = msg.time || formatTime(new Date());
		const colors = getRoleColors(msg.role);
		const bubble = getBubbleStyle(msg.role);

		children.push(
			React.createElement(
				Box,
				{
					key: "msg-" + i,
					flexDirection: "row",
					paddingY: 0,
					justifyContent: bubble.alignment,
				},
				React.createElement(
					Box,
					{
						key: "bubble-" + i,
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
							React.createElement(MarkdownText, { content: msg.content || "" }),
						),
						msg.role === "assistant" && msg.reasoningContent
							? React.createElement(
									Box,
									{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
									React.createElement(
										Text,
										{ dim: true, color: "gray" },
										`(thinking) ` +
											(msg.reasoningContent || "").slice(0, 200) +
											(msg.reasoningContent && msg.reasoningContent.length > 200
												? "\u00b7\u00b7\u00b7"
												: ""),
									),
								)
							: null,
						msg.role === "assistant" && msg.activeToolCall
							? React.createElement(
									Box,
									{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
									React.createElement(
										Text,
										{ dim: true, color: "gray" },
										`- Running: ${msg.activeToolCall.name} \u00b7\u00b7\u00b7`,
									),
								)
							: null,
						msg.role === "assistant" && msg.toolCallDisplay
							? React.createElement(
									Box,
									{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
									...msg.toolCallDisplay
										.split("\n")
										.map((line, j) =>
											React.createElement(
												Text,
												{ key: "tool-" + i + "-" + j, dim: true, color: "gray" },
												"  " + line,
											),
										),
								)
							: null,
					),
				),
			),
		);
	}

	if (messages.length === 0) {
		children.push(
			React.createElement(Text, { key: "empty", gray: true }, " No messages yet. Start chatting!"),
		);
	}

	return children;
}

/**
 * Handle keyboard scroll input on a scroll ref.
 * @param {object} scrollRef - The scroll ref with scrollBy/getViewportHeight methods
 * @param {object} key - The key object from ink's useInput with arrow/page navigation keys
 */
export function handleScrollInput(scrollRef, key) {
	if (!scrollRef) return;
	if (key.upArrow) {
		scrollRef.scrollBy(-1);
	}
	if (key.downArrow) {
		scrollRef.scrollBy(1);
	}
	if (key.pageUp) {
		const height = scrollRef.getViewportHeight() || 1;
		scrollRef.scrollBy(-height);
	}
	if (key.pageDown) {
		const height = scrollRef.getViewportHeight() || 1;
		scrollRef.scrollBy(height);
	}
}

/**
 * Handle terminal resize by remeasuring content heights.
 * @param {object} scrollRef - The scroll ref with measure method
 */
export function handleResize(scrollRef) {
	if (scrollRef) {
		scrollRef.remeasure();
	}
}

/**
 * Auto-scroll to bottom when new messages arrive or streaming content overflows.
 * @param {object} scrollRef - The scroll ref with scroll-to-bottom/height methods
 * @param {Array} messages - The messages array
 * @param {number} previousMessageCount - Previous message count ref value
 * @returns {{ newCount: number, scrolled: boolean }}
 */
export function handleAutoScroll(scrollRef, messages, previousMessageCount) {
	if (!scrollRef || messages.length === 0) {
		return { newCount: previousMessageCount, scrolled: false };
	}
	const isNewMessage = messages.length > previousMessageCount;
	if (isNewMessage) {
		scrollRef.scrollToBottom();
		return { newCount: messages.length, scrolled: true };
	}
	if (messages[messages.length - 1].streaming === true) {
		const contentH = scrollRef.getContentHeight();
		const viewportH = scrollRef.getViewportHeight();
		if (contentH > viewportH) {
			scrollRef.scrollToBottom();
			return { newCount: previousMessageCount, scrolled: true };
		}
	}
	return { newCount: previousMessageCount, scrolled: false };
}

/**
 * Execute scroll input logic.
 * @param {object} scrollRef - The scroll ref
 * @param {object} key - Key object from ink's useInput
 */
export function executeScrollInput(scrollRef, key) {
	handleScrollInput(scrollRef, key);
}

/**
 * Execute resize logic.
 * @param {object} scrollRef - The scroll ref
 */
export function executeResize(scrollRef) {
	handleResize(scrollRef);
}

/**
 * Execute auto-scroll logic.
 * @param {object} scrollRef - The scroll ref
 * @param {Array} messages - Messages array
 * @param {number} previousCount - Previous message count
 * @param {object} countRef - Ref object with .current property
 */
export function executeAutoScroll(scrollRef, messages, previousCount, countRef) {
	const scrollResult = handleAutoScroll(scrollRef, messages, previousCount);
	countRef.current = scrollResult.newCount;
}

/**
 * Conversation panel component with ScrollView-based scrolling.
 * Handles keyboard scroll input, terminal resize remeasurement,
 * and auto-scroll-to-bottom on new messages and streaming overflow.
 */
export function ConversationPanel({ messages = [], assistantName = "Assistant" }) {
	const scrollRef = useRef(null);
	const previousMessageCount = useRef(0);
	const { stdout } = useStdout();

	// Handle keyboard scroll input
	useInput((input, key) => executeScrollInput(scrollRef.current, key));

	// Handle terminal resize by remeasuring content heights
	useEffect(() => {
		if (!stdout) return;
		const resizeHandler = () => executeResize(scrollRef.current);
		stdout.on("resize", resizeHandler);
		return () => {
			stdout.off("resize", resizeHandler);
		};
	}, [stdout]);

	// Auto-scroll to bottom when new messages arrive or when streaming content overflows viewport
	useEffect(() => {
		executeAutoScroll(
			scrollRef.current,
			messages,
			previousMessageCount.current,
			previousMessageCount,
		);
	});

	const children = renderMessages(messages, assistantName);

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(ScrollView, { ref: scrollRef }, ...children),
	);
}
