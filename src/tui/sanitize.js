/**
 * Terminal output sanitization for untrusted text (model output, file names,
 * session/memory content). Removes C0/C1 control characters, including ESC,
 * BEL and CSI/OSC introducers, so text cannot inject terminal sequences.
 */

// C0 except \t (0x09) and \n (0x0a), plus DEL and C1 (0x80-0x9f).
// \r is removed too: it can overwrite earlier text on a line.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/**
 * Strip control characters that could be interpreted by the terminal.
 * Tabs and newlines are preserved.
 * @param {unknown} text - Text to sanitize
 * @returns {string} Sanitized text ("" for null/undefined)
 */
export function sanitizeForTerminal(text) {
	if (text === null || text === undefined) return "";
	return String(text).replace(CONTROL_RE, "");
}

/**
 * Sanitize text meant for a single line (newlines and tabs become spaces).
 * @param {unknown} text - Text to sanitize
 * @returns {string} Single-line sanitized text
 */
export function sanitizeLine(text) {
	return sanitizeForTerminal(text).replace(/[\t\n]+/g, " ");
}
