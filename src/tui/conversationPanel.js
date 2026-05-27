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
function getRoleColors(role) {
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
function getBubbleStyle(role) {
	if (role === "user") {
		return { alignment: "flex-end", border: "green" };
	}
	if (role === "system") {
		return { alignment: "flex-start", border: "yellow" };
	}
	return { alignment: "flex-start", border: "cyan" };
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
	useInput((input, key) => {
		if (!scrollRef.current) return;
		if (key.upArrow) {
			scrollRef.current.scrollBy(-1);
		}
		if (key.downArrow) {
			scrollRef.current.scrollBy(1);
		}
		if (key.pageUp) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(-height);
		}
		if (key.pageDown) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(height);
		}
	});

	// Handle terminal resize by remeasuring content heights
	useEffect(() => {
		const handleResize = () => scrollRef.current?.remeasure();
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
		};
	}, [stdout]);

	// Auto-scroll to bottom when new messages arrive or when streaming content overflows viewport
	useEffect(() => {
		if (!scrollRef.current || messages.length === 0) return;
		const ref = scrollRef.current;
		const isNewMessage = messages.length > previousMessageCount.current;
		if (isNewMessage) {
			ref.scrollToBottom();
			previousMessageCount.current = messages.length;
		} else if (messages[messages.length - 1].streaming === true) {
			const contentH = ref.getContentHeight();
			const viewportH = ref.getViewportHeight();
			if (contentH > viewportH) {
				ref.scrollToBottom();
			}
		}
	});

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

	/* istanbul ignore next */
	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(ScrollView, { ref: scrollRef }, ...children),
	);
}
