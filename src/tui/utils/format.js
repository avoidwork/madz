/**
 * Runtime toggle utilities for the TUI.
 * Handles toggle commands and format specifiers.
 */

/**
 * Available toggle keys and their defaults.
 */
export const TOGGLE_DEFAULTS = {
	autoScroll: true,
	timestamps: true,
	commandEcho: true,
	cursorBreathe: true,
	debugOutput: false,
};

/**
 * Toggle a setting.
 * @param {Object} toggles - Current toggles object
 * @param {string} key - Toggle key
 * @returns {Object} Updated toggles
 */
export function toggleSetting(toggles, key) {
	if (!(key in TOGGLE_DEFAULTS)) {
		return toggles;
	}
	return {
		...toggles,
		[key]: !toggles[key],
	};
}

/**
 * Get toggle display name for a key.
 * @param {string} key - Toggle key
 * @returns {string} Display name
 */
export function getToggleDisplayName(key) {
	const names = {
		autoScroll: 'auto-scroll',
		timestamps: 'timestamps',
		commandEcho: 'command-echo',
		cursorBreathe: 'cursor-breathe',
		debugOutput: 'debug-output',
	};
	return names[key] || key;
}

/**
 * Get toggle status string.
 * @param {boolean} value - Toggle value
 * @returns {string} "ON" or "OFF"
 */
export function getToggleStatus(value) {
	return value ? 'ON' : 'OFF';
}

/**
 * Format a toggle line for display.
 * @param {string} key - Toggle key
 * @param {boolean} value - Toggle value
 * @returns {string} Formatted line
 */
export function formatToggleLine(key, value) {
	const displayName = getToggleDisplayName(key);
	const status = getToggleStatus(value);
	return `  ${displayName.padEnd(16)} ${status}`;
}

/**
 * Get all toggle lines for display.
 * @param {Object} toggles - Current toggles
 * @returns {string} Formatted toggle list
 */
export function formatToggles(toggles) {
	const lines = ['Runtime Toggles:'];
	for (const [key, value] of Object.entries(toggles)) {
		lines.push(formatToggleLine(key, value));
	}
	return lines.join('\n');
}

/**
 * Parse a toggle command and return the result.
 * @param {string[]} args - Command arguments
 * @param {Object} toggles - Current toggles
 * @returns {Object} Result with action and message
 */
export function handleToggleCommand(args, toggles) {
	if (!args || args.length === 0) {
		// No args — show all toggles
		return {
			action: 'toggle',
			message: formatToggles(toggles),
		};
	}

	const key = args[0];
	if (!(key in TOGGLE_DEFAULTS)) {
		return {
			action: 'unknown',
			message: `Unknown toggle: ${key}. Available: ${Object.keys(TOGGLE_DEFAULTS).join(', ')}`,
		};
	}

	const newToggles = toggleSetting(toggles, key);
	const status = newToggles[key] ? 'ON' : 'OFF';
	return {
		action: 'toggle',
		subAction: 'set',
		key,
		value: newToggles[key],
		message: `${getToggleDisplayName(key)} ${status}`,
		toggles: newToggles,
	};
}
