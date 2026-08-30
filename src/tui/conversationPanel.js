import React, { useRef, useEffect } from "react";
import { Box } from "ink";
import { MessageList } from "./messageList.js";

/**
 * Map of common IANA timezones to their native locale.
 * Used to derive 12/24-hour preference and date conventions from the timezone.
 * Falls back to shell locale detection for unmapped zones.
 */
const TZ_LOCALE_MAP = new Map([
	["America/Toronto", "en-CA"],
	["America/New_York", "en-US"],
	["America/Chicago", "en-US"],
	["America/Denver", "en-US"],
	["America/Los_Angeles", "en-US"],
	["America/Vancouver", "en-CA"],
	["America/Montreal", "en-CA"],
	["America/Winnipeg", "en-CA"],
	["America/Halifax", "en-CA"],
	["America/Edmonton", "en-CA"],
	["America/Regina", "en-CA"],
	["America/St_Johns", "en-CA"],
	["America/Puerto_Rico", "en-US"],
	["America/Anchorage", "en-US"],
	["Pacific/Honolulu", "en-US"],
	["Europe/London", "en-GB"],
	["Europe/Berlin", "de-DE"],
	["Europe/Paris", "fr-FR"],
	["Europe/Madrid", "es-ES"],
	["Europe/Rome", "it-IT"],
	["Europe/Amsterdam", "nl-NL"],
	["Europe/Brussels", "nl-BE"],
	["Europe/Vienna", "de-AT"],
	["Europe/Zurich", "de-CH"],
	["Europe/Stockholm", "sv-SE"],
	["Europe/Oslo", "nb-NO"],
	["Europe/Copenhagen", "da-DK"],
	["Europe/Helsinki", "fi-FI"],
	["Europe/Warsaw", "pl-PL"],
	["Europe/Prague", "cs-CZ"],
	["Europe/Budapest", "hu-HU"],
	["Europe/Bucharest", "ro-RO"],
	["Europe/Athens", "el-GR"],
	["Europe/Moscow", "ru-RU"],
	["Europe/Istanbul", "tr-TR"],
	["Asia/Tokyo", "ja-JP"],
	["Asia/Shanghai", "zh-CN"],
	["Asia/Hong_Kong", "zh-HK"],
	["Asia/Taipei", "zh-TW"],
	["Asia/Seoul", "ko-KR"],
	["Asia/Singapore", "en-SG"],
	["Asia/Kolkata", "en-IN"],
	["Asia/Bangkok", "th-TH"],
	["Asia/Jakarta", "id-ID"],
	["Asia/Manila", "fil-PH"],
	["Asia/Dubai", "ar-AE"],
	["Asia/Riyadh", "ar-SA"],
	["Australia/Sydney", "en-AU"],
	["Australia/Melbourne", "en-AU"],
	["Australia/Brisbane", "en-AU"],
	["Australia/Perth", "en-AU"],
	["Australia/Adelaide", "en-AU"],
	["Australia/Darwin", "en-AU"],
	["Pacific/Auckland", "en-NZ"],
	["Africa/Cairo", "ar-EG"],
	["Africa/Johannesburg", "en-ZA"],
	["Africa/Lagos", "en-NG"],
	["America/Sao_Paulo", "pt-BR"],
	["America/Buenos_Aires", "es-AR"],
	["America/Mexico_City", "es-MX"],
	["America/Bogota", "es-CO"],
	["America/Lima", "es-PE"],
	["America/Santiago", "es-CL"],
]);

/**
 * Derive the native locale for a given IANA timezone.
 * Falls back to shell locale detection (LC_ALL/LANG) if the timezone
 * isn't in the map, then to the runtime default.
 *
 * @param {string} tz - IANA timezone identifier (e.g., "America/Toronto")
 * @returns {string} Locale string (e.g., "en_CA", "de_DE")
 */
function detectLocale(tz) {
	// 1. Direct lookup from timezone map
	if (TZ_LOCALE_MAP.has(tz)) return TZ_LOCALE_MAP.get(tz);

	// 2. Fallback: detect from shell environment
	const raw =
		process.env.LC_ALL || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
	const cleaned = raw.split(".")[0];
	// CI environments often have empty LC_ALL/LANG — default to en-US
	return cleaned || "en-US";
}

/**
 * Timezone to use for TUI time display.
 * Lifted from the shell environment; falls back to the runtime's default.
 */
const displayTimezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Cached Intl.DateTimeFormat for localized time display.
 * Uses the host's locale and timezone so 12/24-hour and date conventions
 * follow the user's system preferences.
 * Falls back to en-US if the locale is rejected by ICU.
 */
let timeFormatter;
try {
	timeFormatter = new Intl.DateTimeFormat(detectLocale(displayTimezone), {
		hour: "numeric",
		minute: "2-digit",
		timeZone: displayTimezone,
	});
} catch {
	// Some locales (e.g., "C") are rejected by ICU — fall back to en-US
	timeFormatter = new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: displayTimezone,
	});
}

/**
 * Format a Date as a locale-aware time string using the cached formatter.
 * @param {Date} date - The date to format
 * @returns {string} Localized time string
 */
export function formatTime(date) {
	return timeFormatter.format(date);
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
