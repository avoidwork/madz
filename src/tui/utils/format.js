/**
 * Format utility — format specifiers for message rendering.
 * YAGNI: Implemented as a stub. Full format customization system
 * only if there is a clear, demonstrated need.
 */

/**
 * Format specifiers:
 * - %T — timestamp (respects timestamps toggle)
 * - %t — text body
 * - %B — bold
 * - %n — null color (reset)
 * - %I — italic
 * - %R — red
 * - %C — cyan
 * - %M — magenta
 */

/**
 * Parse a format string and return a formatted template object.
 * @param {string} formatStr - Format string with specifiers
 * @returns {Object} Parsed format template
 */
export function parseFormat(formatStr) {
	return {
		raw: formatStr,
		timestamps: formatStr.includes("%T"),
		body: formatStr.includes("%t"),
		bold: formatStr.includes("%B"),
		italic: formatStr.includes("%I"),
	};
}

/**
 * Apply format specifiers to a message.
 * @param {Object} message - Message object
 * @param {Object} format - Parsed format template
 * @param {boolean} timestampsEnabled - Whether timestamps are enabled
 * @returns {string} Formatted message string
 */
export function applyFormat(message, format, timestampsEnabled) {
	if (!format || !format.body) return message.content || "";

	let result = format.raw;

	if (format.timestamps && timestampsEnabled) {
		result = result.replace(/%T/g, message.time || "");
	} else {
		result = result.replace(/%T/g, "");
	}

	result = result.replace(/%t/g, message.content || "");
	result = result.replace(/%B/g, ""); // Bold is handled by Ink's bold prop
	result = result.replace(/%n/g, ""); // Reset is handled by Ink
	result = result.replace(/%I/g, ""); // Italic is handled by Ink's dimColor
	result = result.replace(/%R/g, ""); // Red is handled by Ink's color
	result = result.replace(/%C/g, ""); // Cyan is handled by Ink's color
	result = result.replace(/%M/g, ""); // Magenta is handled by Ink's color

	return result;
}

/**
 * Stub format command handler.
 * Returns a message indicating format customization is not yet implemented.
 * @returns {string}
 */
export function handleFormatCommand() {
	return "Format customization is not yet implemented. This is a YAGNI stub.";
}
