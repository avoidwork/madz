/**
 * ConversationPanel — simplified thin wrapper around MessageList.
 * All message rendering, state management, and scroll logic is delegated
 * to the MessageList component.
 *
 * @module conversationPanel
 */

import React from "react";
import { Box } from "ink";
import { MessageList } from "./messageList.js";
import MessageBubble from "./messageBubble.js";

/**
 * ConversationPanel component — a thin wrapper that renders MessageList.
 * Does not contain message data, scroll logic, or refs.
 *
 * @param {Object} props
 * @param {React.Ref} [props.scrollRef] - Optional scroll ref passed from parent
 */
export function ConversationPanel({ scrollRef: externalScrollRef }) {
	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(MessageList, { scrollRef: externalScrollRef }),
	);
}

export default ConversationPanel;

/**
 * Format a Date object to HH:MM string.
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string (HH:MM)
 */
export function formatTime(date) {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Get color scheme for a message role.
 * @param {string} role - Message role: "user", "assistant", or "system"
 * @returns {{ label: string, content: string }} Color object for the role
 */
export function getRoleColors(role) {
	switch (role) {
		case "user":
			return { label: "green", content: "white" };
		case "assistant":
			return { label: "cyan", content: "white" };
		case "system":
			return { label: "yellow", content: "yellow" };
		default:
			return { label: "white", content: "white" };
	}
}

/**
 * Get bubble styling for a message role.
 * @param {string} role - Message role: "user", "assistant", or "system"
 * @returns {{ alignment: string, border: string }} Bubble style object
 */
export function getBubbleStyle(role) {
	switch (role) {
		case "user":
			return { alignment: "flex-end", border: "green" };
		case "assistant":
			return { alignment: "flex-start", border: "cyan" };
		case "system":
			return { alignment: "flex-start", border: "yellow" };
		default:
			return { alignment: "flex-start", border: "white" };
	}
}

/**
 * Render a list of messages as React elements.
 * @param {Array} messages - Array of message objects
 * @param {string} assistantName - Name for assistant role label
 * @param {number} [maxMessages] - Maximum number of messages to render (most recent)
 * @returns {Array} Array of React elements
 */
export function renderMessages(messages, assistantName, maxMessages) {
	const msgList = messages || [];

	if (msgList.length === 0) {
		return [
			React.createElement(
				Box,
				{ key: "empty", justifyContent: "center", color: "gray" },
				"No messages yet",
			),
		];
	}

	const limited =
		maxMessages && maxMessages !== Infinity && msgList.length > maxMessages
			? msgList.slice(-maxMessages)
			: msgList;

	return limited.map((msg) => {
		const globalIdx = messages.indexOf(msg);
		return React.createElement(
			MessageBubble,
			{
				key: "msg-" + globalIdx,
				msg: {
					role: msg.role,
					content: msg.content,
					time: msg.time,
					streaming: msg.streaming,
					reasoningContent: msg.reasoningContent,
					activeToolCall: msg.activeToolCall,
					toolCallDisplay: msg.toolCallDisplay,
				},
				assistantName: assistantName,
			},
		);
	});
}
