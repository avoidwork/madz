import React from "react";
import { Box, Text } from "ink";
import { BANNER_ART } from "./banner.js";
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
 * Conversation panel component with virtualized scrolling.
 * Renders only visible messages in the viewport.
 */
export function ConversationPanel({
	messages = [],
	scrollOffset = 0,
	visibleCount = 20,
	assistantName = "Assistant",
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

	const children = BANNER_ART.map((line, i) =>
		React.createElement(Text, { key: "banner-" + i, bold: true, color: "cyan" }, line),
	);

	for (let i = 0; i < visibleMessages.length; i++) {
		const msg = visibleMessages[i];
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
						{ flexDirection: "row" },
						React.createElement(Text, { color: colors.content, wrap: "true" }, msg.content || ""),
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

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		...children,
	);
}
