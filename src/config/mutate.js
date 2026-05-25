import { ConfigSchema } from "./schemas.js";

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

/**
 * Assign a value to a dot-path in an object, creating intermediate objects as needed.
 * Mutates the target object in place.
 * @param {Object} obj - Target object to mutate
 * @param {string} path - Dot-separated path (e.g., "a.b.c")
 * @param {unknown} value - Value to set
 */
export function assignPath(obj, path, value) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (current[keys[i]] === undefined || current[keys[i]] === null) {
			current[keys[i]] = {};
		}
		current = current[keys[i]];
	}
	current[keys[keys.length - 1]] = value;
}

/**
 * Validate a patched config object and apply a dot-path mutation.
 * Caller is responsible for persisting via saveConfig().
 * @param {Object} config - The current config object to mutate
 * @param {string} dotPath - Dot-separated config path (e.g., "telemetry.enabled")
 * @param {string} valueStr - String value to parse and apply
 * @throws {Error} If zod validation fails
 */
export function applyDotPathMutation(config, dotPath, valueStr) {
	const value = parseValue(valueStr);
	const patched = structuredClone(config);
	assignPath(patched, dotPath, value);
	ConfigSchema.parse(patched);
	assignPath(config, dotPath, value);
}
