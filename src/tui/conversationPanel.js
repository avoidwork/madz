import React from "react";
import { Box, Text } from "ink";
import { getRoleLabel, getVisibleMessages } from "./messages.js";

/**
 * Format time as HH:MM from a Date object.
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
	return (
		date.getHours().toString().padStart(2, "0") +
		":" +
		date.getMinutes().toString().padStart(2, "0")
	);
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
 * Conversation panel component with virtualized scrolling.
 * Renders only visible messages in the viewport.
 */
export function ConversationPanel({
	messages = [],
	scrollOffset = 0,
	visibleCount = 20,
	_isScrolling = false,
	_onScroll,
}) {
	const { messages: visibleMessages, _bottomReached } = getVisibleMessages(
		messages,
		scrollOffset,
		visibleCount,
	);

	// Handle scroll via up/down arrows in the conversation area
	// (delegated to parent for history coordination)
	// Scrolling conversation is handled by parent when isScrolling is true.

	const children = [React.createElement(Text, { bold: true, color: "cyan" }, " Conversation ")];

	for (let i = 0; i < visibleMessages.length; i++) {
		if (i > 0) {
			children.push(
				React.createElement(
					Text,
					{ key: "sep-" + i, color: "gray", dim: true },
					"\u2500".repeat(40),
				),
			);
		}
		const msg = visibleMessages[i];
		const time = msg.time || formatTime(new Date());
		const colors = getRoleColors(msg.role);

		children.push(
			React.createElement(
				Box,
				{ key: "msg-" + i },
				React.createElement(Text, { color: "gray" }, "[" + time + "] "),
				React.createElement(Text, { color: colors.label }, getRoleLabel(msg.role) + ": "),
				React.createElement(Text, { color: colors.content, wrap: "wrap" }, msg.content || ""),
			),
		);
	}

	if (messages.length === 0) {
		children.push(
			React.createElement(Text, { key: "empty", gray: true }, " No messages yet. Start chatting!"),
		);
	}

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		...children,
	);
}
