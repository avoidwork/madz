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
 * Get high-contrast color for a message role.
 * @param {string} role
 * @returns {{ label: string, content: string }}
 */
export function getHighContrastColors(role) {
	const cache = getHighContrastColors._cache || (getHighContrastColors._cache = new Map());
	if (!cache.has(role)) {
		if (role === "user") {
			cache.set(role, { label: "white", content: "white" });
		} else if (role === "system") {
			cache.set(role, { label: "white", content: "white" });
		} else {
			cache.set(role, { label: "white", content: "white" });
		}
	}
	return cache.get(role);
}

/**
 * Get high-contrast bubble style with role-specific background tints.
 * @param {string} role
 * @returns {{ alignment: "flex-start" | "flex-end", border: string, background: string }}
 */
export function getHighContrastBubbleStyle(role) {
	const cache =
		getHighContrastBubbleStyle._cache || (getHighContrastBubbleStyle._cache = new Map());
	if (!cache.has(role)) {
		if (role === "user") {
			cache.set(role, { alignment: "flex-end", border: "green", background: "#2a2a2a" });
		} else if (role === "system") {
			cache.set(role, { alignment: "flex-start", border: "yellow", background: "#2a2420" });
		} else {
			cache.set(role, { alignment: "flex-start", border: "cyan", background: "#252525" });
		}
	}
	return cache.get(role);
}

/**
 * Get color for a message role, optionally switching to high-contrast mode.
 * @param {string} role
 * @param {boolean} [highContrast] - Whether to use high-contrast colors
 * @returns {{ label: string, content: string }}
 */
export function getRoleColors(role, highContrast) {
	if (highContrast) {
		return getHighContrastColors(role);
	}
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
 * activeToolCall, toolCallDisplay, and timestamp (appInfo).
 * @param {object} props
 * @param {Message} props.msg - The message data object
 * @param {string} props.assistantName - Name to display for assistant
 * @returns {React.ReactElement}
 */
const MessageBubble = React.memo(
	function MessageBubble({ msg, assistantName, highContrast = false }) {
		const time = msg.time || formatTime(new Date());
		const colors = getRoleColors(msg.role, highContrast);
		const bubble = highContrast ? getHighContrastBubbleStyle(msg.role) : getBubbleStyle(msg.role);

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
						{ dim: !highContrast, color: highContrast ? "white" : "gray", bold: highContrast },
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
						{ dim: !highContrast, color: highContrast ? "white" : "gray", bold: highContrast },
						`- Running: ${msg.activeToolCall.name} \u00b7\u00b7\u00b7`,
					),
				)
			: null;

		const toolDisplayEl = hasToolCallDisplay
			? React.createElement(
					Box,
					{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
					...msg.toolCallDisplay.split("\n").map((line, j) =>
						React.createElement(
							Text,
							{
								key: "tool-" + j,
								dim: !highContrast,
								color: highContrast ? "white" : "gray",
								bold: highContrast,
							},
							"  " + line,
						),
					),
				)
			: null;

		return React.createElement(
			Box,
			{
				key: "msg-" + msg._index,
				flexDirection: "row",
				paddingY: 0,
				justifyContent: bubble.alignment,
			},
			React.createElement(
				Box,
				{
					key: "bubble-" + msg._index,
					flexDirection: "column",
					paddingX: 1,
					borderColor: bubble.border,
					borderStyle: "round",
					maxWidth: "90%",
					backgroundColor: bubble.background,
				},
				React.createElement(
					Box,
					{ flexDirection: "row" },
					React.createElement(
						Text,
						{ color: "gray", dim: !highContrast, bold: highContrast },
						"[" + time + "] ",
					),
					React.createElement(
						Text,
						{ color: colors.label, bold: highContrast },
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
			p._index === n._index &&
			prevProps.assistantName === nextProps.assistantName &&
			prevProps.highContrast === nextProps.highContrast
		);
	},
);

/**
 * Render the conversation message loop for a given messages array.
 * Returns React elements for each message bubble.
 * Uses memoized MessageBubble components to skip re-render of unchanged rows.
 * @param {Array} messages - The messages to render
 * @param {string} assistantName - Name to display for assistant messages
 * @param {boolean} [highContrast] - High-contrast mode flag for accessibility
 * @returns {Array} React elements
 */
export function renderMessages(messages, assistantName, highContrast = false) {
	const children = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		const rowKey = "msg-" + i;

		children.push(
			React.createElement(MessageBubble, {
				key: rowKey,
				msg: { ...msg, _index: i },
				assistantName,
				highContrast,
			}),
		);
	}

	if (messages.length === 0) {
		children.push(
			React.createElement(
				Text,
				{ key: "empty", gray: true, dim: !highContrast, bold: highContrast },
				" No messages yet. Start chatting!",
			),
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
 * @param {object} props
 * @param {Array} [props.messages] - The conversation messages
 * @param {string} [props.assistantName] - Name for assistant role display
 * @param {string} [props.backgroundColor] - Background color hex string (e.g., "#1e1e1e")
 */
export function ConversationPanel({
	messages = [],
	assistantName = "Assistant",
	backgroundColor = "#1e1e1e",
}) {
	const scrollRef = useRef(null);
	const previousMessageCount = useRef(0);
	const lastContentHashRef = useRef(0);
	const { stdout } = useStdout();

	useInput((input, key) => executeScrollInput(scrollRef.current, key));

	useEffect(() => {
		if (!stdout) return;
		const resizeHandler = () => executeResize(scrollRef.current);
		stdout.on("resize", resizeHandler);
		return () => {
			stdout.off("resize", resizeHandler);
		};
	}, [stdout]);

	const prevHash = lastContentHashRef.current;
	lastContentHashRef.current =
		messages.length +
		(messages.length > 0 && messages[messages.length - 1].streaming
			? (messages[messages.length - 1].content || "").length
			: 0);

	if (prevHash !== lastContentHashRef.current && prevHash > 0) {
		executeAutoScroll(
			scrollRef.current,
			messages,
			previousMessageCount.current,
			previousMessageCount,
		);
	} else if (messages.length > 0 && messages[messages.length - 1].streaming) {
		const contentH = scrollRef.current?.getContentHeight();
		const viewportH = scrollRef.current?.getViewportHeight();
		if (contentH && viewportH && contentH > viewportH) {
			scrollRef.current.scrollToBottom();
		}
	}

	const children = React.useMemo(
		() => renderMessages(messages, assistantName),
		[messages, assistantName],
	);

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1, backgroundColor },
		React.createElement(ScrollView, { ref: scrollRef }, ...children),
	);
}
