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
