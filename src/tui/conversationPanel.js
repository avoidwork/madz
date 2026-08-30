import React, { useRef, useEffect } from "react";
import { Box } from "ink";
import { MessageList } from "./messageList.js";

/**
 * Lazily create the Intl.DateTimeFormat so TZ is always set by the time
 * the formatter is needed (module load time may precede env setup).
 */
let _formatter;

/**
 * Get the cached Intl.DateTimeFormat, creating it lazily.
 * Uses the system's default locale (from resolvedOptions) and the
 * host timezone (from TZ env var or resolvedOptions).
 * @returns {Intl.DateTimeFormat}
 */
function getFormatter() {
	if (!_formatter) {
		const { timeZone: defaultTimezone, locale } = Intl.DateTimeFormat().resolvedOptions();
		const tz = process.env.TZ || defaultTimezone;
		try {
			_formatter = new Intl.DateTimeFormat(locale, {
				hour: "numeric",
				minute: "2-digit",
				timeZone: tz,
			});
		} catch {
			_formatter = new Intl.DateTimeFormat("en-US", {
				hour: "numeric",
				minute: "2-digit",
				timeZone: tz,
			});
		}
	}
	return _formatter;
}

/**
 * Format a Date as a locale-aware time string using the cached formatter.
 * @param {Date} date - The date to format
 * @returns {string} Localized time string
 */
export function formatTime(date) {
	return getFormatter().format(date);
}

/**
 * Get color for a message role (cached).
 * @param {string} role
 * @returns {{ label: string, content: string }}
 */
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

/**
 * Get bubble layout props (alignment + colors) for a message role (cached).
 * @param {string} role
 * @returns {{ alignment: "flex-start" | "flex-end", border: string }}
 */
export function getBubbleStyle(role) {
	const cache = getBubbleStyle._cache || (getBubbleStyle._cache = new Map());
	if (!cache.has(role)) {
		if (role === "user") {
			cache.set(role, { alignment: "flex-start", border: "green" });
		} else if (role === "system") {
			cache.set(role, { alignment: "flex-start", border: "yellow" });
		} else {
			cache.set(role, { alignment: "flex-start", border: "cyan" });
		}
	}
	return cache.get(role);
}

/**
 * Conversation panel component — thin wrapper delegating to MessageList.
 * Supports two modes: legacy (messages prop for session restore) and
 * component-based (messageListRef for imperative updates).
 * In component-based mode, MessageList is populated from initial messages
 * and all subsequent updates happen via the ref imperatively.
 * @param {Object} props
 * @param {Array} [props.messages] - Messages to display (for session restore)
 * @param {string} [props.assistantName] - Name for assistant messages
 * @param {React.Ref} [props.scrollRef] - Optional external scroll ref
 * @param {React.Ref} [props.messageListRef] - Optional ref for imperative access
 * @returns {React.ReactElement}
 */
export const ConversationPanel = React.memo(function ConversationPanel({
	messages = [],
	assistantName = "Assistant",
	scrollRef: externalScrollRef,
	messageListRef,
}) {
	const internalListRef = useRef(null);
	const panelRef = messageListRef || internalListRef;

	// Initialize MessageList from messages data on first mount / session restore
	useEffect(() => {
		if (panelRef.current && messages?.length > 0) {
			panelRef.current.setMessages(messages);
		}
	}, []); // Only on mount — messages change not needed

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(MessageList, {
			ref: panelRef,
			assistantName,
			scrollRef: externalScrollRef,
		}),
	);
});
