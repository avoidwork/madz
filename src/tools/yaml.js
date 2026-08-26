import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { load, dump } from "js-yaml";

/**
 * Parse a YAML string into an object.
 * @param {string} input - YAML string to parse
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
function parseYaml(input) {
	try {
		const data = load(input);
		return { ok: true, data: data ?? null };
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
	}
}

/**
 * Serialize an object to a YAML string.
 * @param {string} input - JSON stringified object to serialize
 * @param {object} [opts] - Serialization options
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function serializeYaml(input, opts = {}) {
	let obj;
	try {
		obj = typeof input === "string" ? JSON.parse(input) : input;
	} catch (err) {
		return { ok: false, error: `Invalid JSON input: ${err.message}` };
	}

	const indent = opts.indent || 2;
	return { ok: true, data: dump(obj, { indent, lineWidth: opts.lineWidth || 80 }) };
}

/**
 * Transform YAML data using mapping rules.
 * @param {string} input - YAML string input
 * @param {string} mapping - JSON string mapping rules (key → key)
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
function transformYaml(input, mapping) {
	let data;
	try {
		data = load(input) ?? {};
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
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
 * Filter YAML data using path expressions.
 * @param {string} input - YAML string input
 * @param {string} path - Dot-notation path expression
 * @returns {{ ok: boolean, data?: unknown, error?: string }}
 */
function filterYaml(input, path) {
	let data;
	try {
		data = load(input);
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
	}

	// Handle [*] wildcard for array filtering
	if (path.includes("[*]")) {
		const [basePath, filterKey] = path.split("[*]");
		const baseParts = basePath.split(".").filter(Boolean);
		const keyParts = filterKey.split(".").filter(Boolean);
		let baseObj = data;
		for (const part of baseParts) {
			if (baseObj === undefined || baseObj === null) {
				return { ok: true, data: undefined };
			}
			baseObj = baseObj[part];
		}
		if (!Array.isArray(baseObj)) {
			return { ok: false, error: `Path does not lead to an array: ${basePath}` };
		}
		if (keyParts.length > 0) {
			const results = [];
			for (const item of baseObj) {
				if (item && typeof item === "object") {
					let val = item;
					let found = true;
					for (const kp of keyParts) {
						if (val === undefined || val === null || !(kp in val)) {
							found = false;
							break;
						}
						val = val[kp];
					}
					if (found) results.push(val);
				}
			}
			return { ok: true, data: results };
		}
		return { ok: true, data: baseObj };
	}

	const parts = path.split(".");
	let current = data;

	for (const part of parts) {
		if (current === undefined || current === null) {
			return { ok: true, data: undefined };
		}
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
 * Access a value in YAML data using dot notation or array indices.
 * @param {string} input - YAML string input
 * @param {string} path - Dot-notation path
 * @returns {{ ok: boolean, data?: unknown, error?: string }}
 */
function accessYamlPath(input, path) {
	return filterYaml(input, path);
}

/**
 * YAML manipulation tool — parse, serialize, transform, filter, and access YAML data.
 * @param {string} input - JSON string with action, input, path, mapping
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function yamlManipulation(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return yamlManipulationImpl(parsed);
}

/**
 * YAML manipulation implementation — takes a plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function yamlManipulationImpl(input) {
	const schema = z.object({
		action: z
			.enum(["parse", "serialize", "transform", "filter", "access"])
			.describe("Action to perform"),
		input: z.string().describe("YAML string input"),
		path: z.string().optional().describe("Dot-notation path expression"),
		mapping: z.string().optional().describe("JSON string mapping rules for transform action"),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const { action, input: yamlInput, path, mapping } = validated.data;

	switch (action) {
		case "parse": {
			const result = parseYaml(yamlInput);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "serialize": {
			const parsed = parseYaml(yamlInput);
			if (!parsed.ok) return parsed;
			const result = serializeYaml(parsed.data);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "transform": {
			if (!mapping) {
				return { ok: false, error: "Mapping is required for transform action" };
			}
			const result = transformYaml(yamlInput, mapping);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		case "filter":
		case "access": {
			if (!path) {
				return { ok: false, error: "Path is required for filter/access action" };
			}
			const result =
				action === "filter" ? filterYaml(yamlInput, path) : accessYamlPath(yamlInput, path);
			return result.ok ? { ok: true, data: result.data } : result;
		}
		default:
			return { ok: false, error: `Unknown action: ${action}` };
	}
}

/**
 * Create the LangChain tool wrapper for YAML manipulation.
 * @returns {object} LangChain Tool instance
 */
export function createYamlTool() {
	return tool(
		async (input) => {
			const result = await yamlManipulation(input);
			return JSON.stringify(result, null, 2);
		},
		{
			name: "yaml",
			description:
				"Parse, serialize, transform, filter, and access YAML data. Actions: parse (string→object), serialize (object→string), transform (apply key mapping rules), filter (dot-notation path filter), access (dot-notation path access including array indices).",
			schema: z.object({
				action: z
					.enum(["parse", "serialize", "transform", "filter", "access"])
					.describe("Action to perform"),
				input: z.string().describe("YAML string input"),
				path: z.string().optional().describe("Dot-notation path expression"),
				mapping: z.string().optional().describe("JSON string mapping rules for transform action"),
			}),
		},
	);
}
