import React from "react";
import { Box, Text } from "ink";
import { getRoleLabel, getVisibleMessages } from "./messages.js";

/**
 * Conversation panel component with virtualized scrolling.
 * Renders only visible messages in the viewport.
 */
export function ConversationPanel({ messages = [], scrollOffset = 0, visibleCount = 20 }) {
	const { messages: visibleMessages } = getVisibleMessages(messages, scrollOffset, visibleCount);

	const children = [React.createElement(Text, { bold: true, color: "cyan" }, " Conversation ")];

	for (let i = 0; i < visibleMessages.length; i++) {
		const msg = visibleMessages[i];
		children.push(
			React.createElement(
				Box,
				{ key: "msg-" + i },
				React.createElement(Text, { color: "gray" }, "[" + getRoleLabel(msg.role) + "] "),
				React.createElement(Text, { wrap: "wrap" }, msg.content || ""),
			),
		);
	}

	if (messages.length === 0) {
		children.push(
			React.createElement(Text, { key: "empty", gray: true }, " No messages yet. Start chatting!"),
		);
	}

	return React.createElement(Box, { key: "panel", flexDirection: "column" }, ...children);
}
