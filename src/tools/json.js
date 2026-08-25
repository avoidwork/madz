import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { JSONPath } from "jsonpath-plus";

/**
 * Parse a JSON string into an object.
 * @param {string} input - JSON string to parse
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
function parseJson(input) {
	try {
		return { ok: true, data: JSON.parse(input) };
	} catch (err) {
		return { ok: false, error: `JSON parse error: ${err.message}` };
	}
}

/**
 * Serialize an object to a JSON string.
 * @param {string} input - JSON stringified object to serialize
 * @param {object} [opts] - Serialization options
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function serializeJson(input, opts = {}) {
	let obj;
	try {
		obj = typeof input === "string" ? JSON.parse(input) : input;
	} catch (err) {
		return { ok: false, error: `Invalid JSON input: ${err.message}` };
	}

	const space = opts.space || 2;
	return { ok: true, data: JSON.stringify(obj, null, space) };
}

/**
 * Transform JSON data using mapping rules.
 * @param {string} input - JSON string input
 * @param {string} mapping - JSON string mapping rules (key → key)
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
function transformJson(input, mapping) {
	let data;
	try {
		data = JSON.parse(input);
	} catch (err) {
		return { ok: false, error: `JSON parse error: ${err.message}` };
	}

	let rules;
	try {
		rules = typeof mapping === "string" ? JSON.parse(mapping) : mapping;
	} catch (err) {
		return { ok: false, error: `Invalid mapping JSON: ${err.message}` };
	}

	if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
		return { ok: false, error: "Mapping must be an object with key-value pairs" };
	}

	const transform = (obj) => {
		if (obj === null || obj === undefined) return obj;
		if (typeof obj !== "object") return obj;
		if (Array.isArray(obj)) return obj.map(transform);

		const result = {};
		for (const [newKey, oldKey] of Object.entries(rules)) {
			if (typeof oldKey === "string" && oldKey in obj) {
				result[newKey] = transform(obj[oldKey]);
			} else if (typeof oldKey === "object" && oldKey !== null) {
				// Nested mapping: { newKey: { oldKey: "nested.old.path" } }
				for (const [nestedNew, nestedOld] of Object.entries(oldKey)) {
					if (typeof nestedOld === "string") {
						const parts = nestedOld.split(".");
						let val = obj;
						for (const part of parts) {
							if (val === undefined || val === null) {
								val = undefined;
								break;
							}
							val = val[part];
						}
						if (val !== undefined) {
							result[nestedNew] = transform(val);
						}
					}
				}
			}
		}
		return result;
	};

	return { ok: true, data: transform(data) };
}

/**
 * Filter JSON data using JSONPath expressions.
 * @param {string} input - JSON string input
 * @param {string} path - JSONPath expression
 * @returns {{ ok: boolean, data?: unknown, error?: string }}
 */
function filterJson(input, path) {
	let data;
	try {
		data = JSON.parse(input);
	} catch (err) {
		return { ok: false, error: `JSON parse error: ${err.message}` };
	}

	try {
		const results = JSONPath({ path, json: data, resultType: "value" });
		return { ok: true, data: results };
	} catch (err) {
		return { ok: false, error: `JSONPath error: ${err.message}` };
	}
}

/**
 * Access a value in JSON data using dot notation or array indices.
 * @param {string} input - JSON string input
 * @param {string} path - Dot-notation path (e.g., "user.name", "items[0].id")
 * @returns {{ ok: boolean, data?: unknown, error?: string }}
 */
function accessJsonPath(input, path) {
	let data;
	try {
		data = JSON.parse(input);
	} catch (err) {
		return { ok: false, error: `JSON parse error: ${err.message}` };
	}

	const parts = path.split(".");
	let current = data;

	for (const part of parts) {
		if (current === undefined || current === null) {
			return { ok: true, data: undefined };
		}
		// Handle array index notation: items[0]
		const match = part.match(/^(\w+)(\[\d+\])$/);
		if (match) {
			const [, key, idx] = match;
			if (key in current) {
				current = current[key];
			} else {
				return { ok: false, error: `Key not found: ${key}` };
			}
			const arrIdx = parseInt(idx.slice(1, -1), 10);
			if (Array.isArray(current)) {
				if (arrIdx >= 0 && arrIdx < current.length) {
					current = current[arrIdx];
				} else {
					return { ok: false, error: `Array index out of bounds: ${arrIdx}` };
				}
			} else {
				return { ok: false, error: `Not an array: ${key}` };
			}
		} else {
			if (typeof current === "object" && current !== null && part in current) {
				current = current[part];
			} else {
				return { ok: false, error: `Path not found: ${path}` };
			}
		}
	}

	return { ok: true, data: current };
}

/**
 * JSON manipulation tool — parse, serialize, transform, filter, and access JSON data.
 * @param {string} input - JSON string with action, input, path, mapping
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function jsonManipulation(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return jsonManipulationImpl(parsed);
}

/**
 * JSON manipulation implementation — takes a plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function jsonManipulationImpl(input) {
	const schema = z.object({
		action: z.enum(["parse", "serialize", "transform", "filter", "access"]).describe("Action to perform"),
		input: z.string().describe("JSON string input"),
		path: z.string().optional().describe("JSONPath expression or dot-notation path"),
		mapping: z.string().optional().describe("JSON string mapping rules for transform action"),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const { action, input: jsonInput, path, mapping } = validated.data;

	switch (action) {
		case "parse": {
			const result = parseJson(jsonInput);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "serialize": {
			const result = serializeJson(jsonInput);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "transform": {
			if (!mapping) {
				return { ok: false, error: "Mapping is required for transform action" };
			}
			const result = transformJson(jsonInput, mapping);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "filter": {
			if (!path) {
				return { ok: false, error: "Path (JSONPath expression) is required for filter action" };
			}
			const result = filterJson(jsonInput, path);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "access": {
			if (!path) {
				return { ok: false, error: "Path is required for access action" };
			}
			const result = accessJsonPath(jsonInput, path);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		default:
			return { ok: false, error: `Unknown action: ${action}` };
	}
}

/**
 * Create the LangChain tool wrapper for JSON manipulation.
 * @returns {object} LangChain Tool instance
 */
export function createJsonTool() {
	return tool(async (input) => {
		const result = await jsonManipulation(input);
		return JSON.stringify(result, null, 2);
	}, {
		name: "json",
		description:
			"Parse, serialize, transform, filter, and access JSON data. Actions: parse (string→object), serialize (object→string), transform (apply key mapping rules), filter (JSONPath expressions via jsonpath-plus), access (dot-notation path access including array indices).",
		schema: z.object({
			action: z.enum(["parse", "serialize", "transform", "filter", "access"]).describe("Action to perform"),
			input: z.string().describe("JSON string input"),
			path: z.string().optional().describe("JSONPath expression (filter) or dot-notation path (access)"),
			mapping: z.string().optional().describe("JSON string mapping rules for transform action"),
		}),
	});
}