/**
 * Format specifiers and toggle logic for TUI.
 * Provides runtime toggle commands and format utilities.
 */

/**
 * Toggleable state keys and their display names.
 */
export const TOGGLE_KEYS = {
	autoScroll: "scroll",
	timestamps: "ts",
	commandEcho: "echo",
	cursorBreathe: "cursor",
	debugOutput: "debug",
};

/**
 * Get the display name for a toggle key.
 * @param {string} key - Toggle key
 * @returns {string} Display name
 */
export function getToggleDisplayName(key) {
	return TOGGLE_KEYS[key] || key;
}

/**
 * Get all toggle keys.
 * @returns {string[]}
 */
export function getToggleKeys() {
	return Object.keys(TOGGLE_KEYS);
}

/**
 * Get toggle state string for status bar display.
 * @param {Object} toggles - Toggle config object
 * @returns {string} Status bar string (e.g., "[ts:1 scroll:1]")
 */
export function getToggleStatusString(toggles) {
	const parts = [];
	for (const [key, display] of Object.entries(TOGGLE_KEYS)) {
		const value = toggles[key] ? 1 : 0;
		parts.push(`${display}:${value}`);
	}
	return `[${parts.join(" ")}]`;
}

/**
 * Parse a toggle key from a short name or full name.
 * @param {string} name - Toggle name (e.g., "ts", "timestamps", "scroll")
 * @returns {string|null} Mapped toggle key or null
 */
export function parseToggleKey(name) {
	// Check full names first
	if (TOGGLE_KEYS[name]) return name;

	// Check short names (reverse lookup)
	for (const [key, short] of Object.entries(TOGGLE_KEYS)) {
		if (short === name) return key;
	}

	return null;
}

/**
 * Format a number using Intl.NumberFormat with the user's locale.
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
	try {
		const locale = Intl.DateTimeFormat().resolvedOptions().locale;
		const formatter = new Intl.NumberFormat(locale, {
			maximumFractionDigits: 0,
		});
		const result = formatter.format(num);
		if (result === "NaN" || result === "-NaN") {
			return String(num);
		}
		return result;
	} catch {
		return String(num);
	}
}

/**
 * Convert a raw number to a human-readable abbreviated form.
 * @param {number} num - Number to convert
 * @returns {string} Human-readable string representation
 */
export function formatSize(bytes) {
	if (bytes === 0) return "0";
	if (bytes < 1024) return String(bytes);
	const units = ["k", "M"];
	const exp = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / Math.pow(1024, exp);
	const locale = Intl.DateTimeFormat().resolvedOptions().locale;
	const formatted =
		value % 1 === 0
			? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value))
			: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
	return formatted + units[exp - 1];
}

/**
 * Check if timestamps should be shown for a message.
 * @param {Object} toggles - Toggle config
 * @returns {boolean}
 */
export function shouldShowTimestamps(toggles) {
	return toggles?.timestamps !== false; // default true
}

/**
 * Check if command echo should be shown.
 * @param {Object} toggles - Toggle config
 * @returns {boolean}
 */
export function shouldEchoCommands(toggles) {
	return toggles?.commandEcho !== false; // default true
}

/**
 * Check if debug output should be shown.
 * @param {Object} toggles - Toggle config
 * @returns {boolean}
 */
export function shouldShowDebug(toggles) {
	return toggles?.debugOutput === true; // default false
}

/**
 * Check if cursor should breathe (animate).
 * @param {Object} toggles - Toggle config
 * @returns {boolean}
 */
export function shouldBreatheCursor(toggles) {
	return toggles?.cursorBreathe !== false; // default true
}

/**
 * Check if auto-scroll should be enabled.
 * @param {Object} toggles - Toggle config
 * @returns {boolean}
 */
export function shouldAutoScroll(toggles) {
	return toggles?.autoScroll !== false; // default true
}
