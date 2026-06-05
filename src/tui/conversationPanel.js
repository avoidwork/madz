// conversationPanel.js - TUI conversation panel with native sticky scroll
import React, { useMemo } from "react";
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
			cache.set(role, { label: "#00FF00", content: "#FFFFFF" });
		} else if (role === "system") {
			cache.set(role, { label: "#FFFF00", content: "#FFFF00" });
		} else {
			cache.set(role, { label: "#00FFFF", content: "#FFFFFF" });
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
			cache.set(role, { alignment: "flex-end", border: "#00FF00" });
		} else if (role === "system") {
			cache.set(role, { alignment: "flex-start", border: "#FFFF00" });
		} else {
			cache.set(role, { alignment: "flex-start", border: "#00FFFF" });
		}
	}
	return cache.get(role);
}

/**
 * Memoized message bubble component.
 * @param {object} props
 * @param {object} props.msg - The message data object
 * @param {string} props.assistantName - Name to display for assistant
 * @returns {JSX.Element}
 */
const MessageBubble = React.memo(function MessageBubble({ msg, assistantName }) {
	const time = msg.time || formatTime(new Date());
	const colors = getRoleColors(msg.role);
	const bubble = getBubbleStyle(msg.role);

	const content = msg.content || "";
	const hasReasoning = msg.role === "assistant" && msg.reasoningContent;
	const hasActiveToolCall = msg.role === "assistant" && msg.activeToolCall;
	const hasToolCallDisplay = msg.role === "assistant" && msg.toolCallDisplay;

	const reasoningEl = hasReasoning ? (
		<box flexDirection="row" marginTop={1} marginLeft={2}>
			<text fg="#888888" style={{ dim: true }}>
				{`(thinking) ` +
					(msg.reasoningContent || "").slice(0, 200) +
					(msg.reasoningContent && msg.reasoningContent.length > 200 ? "\u00b7\u00b7\u00b7" : "")}
			</text>
		</box>
	) : null;

	const toolCallEl = hasActiveToolCall ? (
		<box flexDirection="row" marginTop={1} marginLeft={2}>
			<text fg="#888888" style={{ dim: true }}>
				`- Running: ${msg.activeToolCall.name} \u00b7\u00b7\u00b7`
			</text>
		</box>
	) : null;

	const toolDisplayEl = hasToolCallDisplay ? (
		<box flexDirection="column" marginTop={1} marginLeft={2}>
			{msg.toolCallDisplay.split("\n").map((line, j) => (
				<text key={"tool-" + j} fg="#888888" style={{ dim: true }}>
					{"  " + line}
				</text>
			))}
		</box>
	) : null;

	return (
		<box
			key={"msg-" + msg._index}
			flexDirection="row"
			paddingY={0}
			justifyContent={bubble.alignment}
		>
			<box
				key={"bubble-" + msg._index}
				flexDirection="column"
				paddingX={1}
				borderColor={bubble.border}
				borderStyle="rounded"
				maxWidth="90%"
			>
				<box flexDirection="row">
					<text fg="#888888">{"[" + time + "] "}</text>
					<text fg={colors.label} bold>
						{getRoleLabel(msg.role, assistantName) + ": "}
					</text>
				</box>
				<box flexDirection="column">
					<box flexDirection="row">
						<MarkdownText content={content} />
					</box>
					{reasoningEl}
					{toolCallEl}
					{toolDisplayEl}
				</box>
			</box>
		</box>
	);
});

/**
 * Get role label for display.
 * @param {string} role
 * @param {string} assistantName
 * @returns {string}
 */
function getRoleLabel(role, assistantName) {
	switch (role) {
		case "user":
			return "You";
		case "assistant":
			return assistantName || "Assistant";
		case "system":
			return "System";
		default:
			return role || "Unknown";
	}
}

/**
 * Render the conversation message loop for a given messages array.
 * @param {Array} messages - The messages to render
 * @param {string} assistantName - Name to display for assistant messages
 * @returns {Array} React elements
 */
export function renderMessages(messages, assistantName) {
	const children = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		const rowKey = "msg-" + i;

		children.push(
			<MessageBubble key={rowKey} msg={{ ...msg, _index: i }} assistantName={assistantName} />,
		);
	}

	if (messages.length === 0) {
		children.push(
			<text key="empty" fg="#888888">
				{" No messages yet. Start chatting!"}
			</text>,
		);
	}

	return children;
}

/**
 * Conversation panel component with native sticky scroll.
 * Uses OpenTUI ScrollBox for keyboard navigation and auto-scroll.
 * @param {object} props
 * @param {Array} props.messages - The messages to display
 * @param {string} props.assistantName - Name to display for assistant
 * @returns {JSX.Element}
 */
export function ConversationPanel({ messages = [], assistantName = "Assistant" }) {
	const children = useMemo(
		() => renderMessages(messages, assistantName),
		[messages, assistantName],
	);

	return (
		<box key="panel" flexDirection="column" flexGrow={1}>
			<scrollbox stickyScroll={true} stickyStart="bottom">
				{children}
			</scrollbox>
		</box>
	);
}
