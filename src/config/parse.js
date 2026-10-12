/**
 * Parse a string value into the correct JavaScript type.
 * @param {string} str - String to parse (e.g., "true", "42", "hello")
 * @returns {boolean|number|string} Parsed value
 */
export function parseValue(str) {
	if (str === "true") return true;
	if (str === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
	return str;
}
