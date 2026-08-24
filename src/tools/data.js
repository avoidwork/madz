import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { load as loadYaml, dump as dumpYaml } from "js-yaml";
import { JSONPath } from "jsonpath-plus";
import { parse } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";

/**
 * Zod schema for data manipulation and transformation input.
 */
export const DataToolSchema = z.object({
	action: z
		.enum([
			"parse",
			"serialize",
			"filter",
			"transform",
			"validate",
			"yamlParse",
			"yamlSerialize",
			"yamlPath",
			"yamlTransform",
			"yamlValidate",
			"jsonToCsv",
			"csvToJson",
			"jsonToYaml",
			"yamlToJson",
			"mapFields",
		])
		.describe("Data action to perform"),
	input: z.string().optional().describe("String input (JSON/YAML/CSV)"),
	data: z.any().optional().describe("Object input (for serialization)"),
	path: z.string().optional().describe("JSONPath or dot-notation path"),
	schema: z.any().optional().describe("Schema for validation"),
	mapping: z
		.object({
			renames: z.record(z.string()).optional().describe("Field rename map"),
			additions: z.record(z.any()).optional().describe("Fields to add"),
			removals: z.array(z.string()).optional().describe("Fields to remove"),
		})
		.optional()
		.describe("Transformation mapping rules"),
	indent: z.number().optional().describe("Serialization indent (default: 2)"),
});

/**
 * Parse JSON string to object.
 * @param {string} input - JSON string
 * @returns {object} Parse result
 */
function parseJson(input) {
	if (!input || typeof input !== "string") {
		return { ok: false, error: "Input must be a non-empty string" };
	}
	try {
		const parsed = JSON.parse(input);
		return { ok: true, data: parsed };
	} catch (err) {
		return { ok: false, error: `JSON parse error: ${err.message}` };
	}
}

/**
 * Serialize object to JSON string.
 * @param {object} data - Object to serialize
 * @param {number} [indent=2] - Indentation
 * @returns {object} Serialization result
 */
function serializeJson(data, indent = 2) {
	try {
		const serialized = JSON.stringify(data, null, indent);
		return { ok: true, data: serialized };
	} catch (err) {
		return { ok: false, error: `Serialization error: ${err.message}` };
	}
}

/**
 * Filter JSON using JSONPath.
 * @param {object} data - Parsed JSON data
 * @param {string} path - JSONPath expression
 * @returns {object} Filter result
 */
function filterJson(data, path) {
	if (!path) {
		return { ok: false, error: "path is required for filter action" };
	}
	try {
		const results = JSONPath({ path, json: data });
		return { ok: true, data: results };
	} catch (err) {
		return { ok: false, error: `JSONPath error: ${err.message}` };
	}
}

/**
 * Transform JSON using mapping rules.
 * @param {object} data - Object to transform
 * @param {object} mapping - Mapping rules
 * @returns {object} Transformation result
 */
function transformJson(data, mapping) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		return { ok: false, error: "Transform requires an object (not array) as input" };
	}

	const result = { ...data };

	// Apply renames
	if (mapping?.renames) {
		for (const [from, to] of Object.entries(mapping.renames)) {
			if (result[from] !== undefined) {
				result[to] = result[from];
				delete result[from];
			}
		}
	}

	// Apply additions
	if (mapping?.additions) {
		Object.assign(result, mapping.additions);
	}

	// Apply removals
	if (mapping?.removals) {
		for (const field of mapping.removals) {
			delete result[field];
		}
	}

	return { ok: true, data: result };
}

/**
 * Validate JSON against a schema using zod-like validation.
 * @param {object} data - Data to validate
 * @param {object} schema - Schema definition
 * @returns {object} Validation result
 */
function validateJson(data, schema) {
	if (!schema) {
		return { ok: false, error: "schema is required for validate action" };
	}

	const errors = [];
	const valid = validateAgainstSchema(data, schema, errors, "");

	return {
		ok: true,
		valid,
		errors: valid ? [] : errors,
	};
}

/**
 * Recursively validate data against a schema.
 * @param {any} data - Data to validate
 * @param {object} schema - Schema definition
 * @param {string[]} errors - Error accumulator
 * @param {string} path - Current path
 * @returns {boolean} Whether valid
 */
function validateAgainstSchema(data, schema, errors, path) {
	if (schema.type === "object") {
		if (typeof data !== "object" || Array.isArray(data)) {
			errors.push(`${path || "root"}: expected object, got ${typeof data}`);
			return false;
		}
		if (schema.properties) {
			let valid = true;
			for (const [key, propSchema] of Object.entries(schema.properties)) {
				if (schema.required && schema.required.includes(key)) {
					if (!(key in data)) {
						errors.push(`${path ? `${path}.` : ""}${key}: required field missing`);
						valid = false;
					}
				}
				if (key in data) {
					const fieldValid = validateAgainstSchema(
						data[key],
						propSchema,
						errors,
						`${path ? `${path}.` : ""}${key}`,
					);
					if (!fieldValid) valid = false;
				}
			}
			return valid;
		}
		return true;
	}

	if (schema.type === "array") {
		if (!Array.isArray(data)) {
			errors.push(`${path || "root"}: expected array, got ${typeof data}`);
			return false;
		}
		if (schema.items) {
			for (let i = 0; i < data.length; i++) {
				const valid = validateAgainstSchema(
					data[i],
					schema.items,
					errors,
					`${path ? `${path}.` : ""}[${i}]`,
				);
				if (!valid) return false;
			}
		}
		return true;
	}

	if (schema.type === "string") {
		if (typeof data !== "string") {
			errors.push(`${path || "root"}: expected string, got ${typeof data}`);
			return false;
		}
	}

	if (schema.type === "number" || schema.type === "integer") {
		if (typeof data !== "number") {
			errors.push(`${path || "root"}: expected ${schema.type}, got ${typeof data}`);
			return false;
		}
	}

	if (schema.type === "boolean") {
		if (typeof data !== "boolean") {
			errors.push(`${path || "root"}: expected boolean, got ${typeof data}`);
			return false;
		}
	}

	return true;
}

/**
 * Parse YAML string to object.
 * @param {string} input - YAML string
 * @returns {object} Parse result
 */
function parseYaml(input) {
	if (!input || typeof input !== "string") {
		return { ok: false, error: "Input must be a non-empty string" };
	}
	try {
		const parsed = loadYaml(input);
		return { ok: true, data: parsed };
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
	}
}

/**
 * Serialize object to YAML string.
 * @param {object} data - Object to serialize
 * @param {number} [indent=2] - Indentation
 * @returns {object} Serialization result
 */
function serializeYaml(data, indent = 2) {
	try {
		const serialized = dumpYaml(data, { indent, lineWidth: 100 });
		return { ok: true, data: serialized };
	} catch (err) {
		return { ok: false, error: `YAML serialization error: ${err.message}` };
	}
}

/**
 * Access YAML data using dot-notation path.
 * @param {object} data - Parsed YAML data
 * @param {string} path - Dot-notation path (e.g., "database.host")
 * @returns {object} Access result
 */
function accessYamlPath(data, path) {
	if (!path) {
		return { ok: false, error: "path is required for path access" };
	}
	const parts = path
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.filter(Boolean);
	let current = data;
	for (const part of parts) {
		if (current === null || current === undefined) {
			return { ok: true, data: null };
		}
		current = current[part];
	}
	return { ok: true, data: current };
}

/**
 * Transform YAML using mapping rules.
 * @param {object} data - Object to transform
 * @param {object} mapping - Mapping rules
 * @returns {object} Transformation result
 */
function transformYaml(data, mapping) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		return { ok: false, error: "Transform requires an object (not array) as input" };
	}

	const result = { ...data };

	if (mapping?.renames) {
		for (const [from, to] of Object.entries(mapping.renames)) {
			if (result[from] !== undefined) {
				result[to] = result[from];
				delete result[from];
			}
		}
	}
	if (mapping?.additions) {
		Object.assign(result, mapping.additions);
	}
	if (mapping?.removals) {
		for (const field of mapping.removals) {
			delete result[field];
		}
	}

	return { ok: true, data: result };
}

/**
 * Validate YAML data structure.
 * @param {object} data - Parsed YAML data
 * @param {object} schema - Schema definition
 * @returns {object} Validation result
 */
function validateYaml(data, schema) {
	if (!schema) {
		return { ok: false, error: "schema is required for validate action" };
	}
	const errors = [];
	const valid = validateAgainstSchema(data, schema, errors, "");
	return {
		ok: true,
		valid,
		errors: valid ? [] : errors,
	};
}

/**
 * Convert JSON array to CSV.
 * @param {object[]} data - Array of objects
 * @param {object} mapping - Optional field mapping
 * @returns {object} CSV result
 */
function jsonToCsv(data) {
	if (!Array.isArray(data)) {
		return { ok: false, error: "JSON to CSV requires an array of objects" };
	}
	if (data.length === 0) {
		return { ok: true, data: "" };
	}

	// Flatten nested objects
	const flatten = (obj, prefix = "") => {
		const result = {};
		for (const [key, value] of Object.entries(obj)) {
			const fullKey = prefix ? `${prefix}.${key}` : key;
			if (value && typeof value === "object" && !Array.isArray(value)) {
				Object.assign(result, flatten(value, fullKey));
			} else {
				result[fullKey] = value;
			}
		}
		return result;
	};

	const flattened = data.map((row) => flatten(row));
	const headers = [...new Set(flattened.flatMap(Object.keys))];

	const records = flattened.map((row) => {
		const record = {};
		for (const header of headers) {
			record[header] = row[header] !== undefined ? row[header] : "";
		}
		return record;
	});

	const csv = stringifyCsv(records, {
		header: true,
		columns: headers.map((h) => ({ header: h, key: h })),
	});
	return { ok: true, data: csv };
}

/**
 * Convert CSV to JSON array.
 * @param {string} input - CSV string
 * @returns {object} JSON result
 */
function csvToJson(input) {
	if (!input || typeof input !== "string") {
		return { ok: false, error: "Input must be a non-empty CSV string" };
	}
	try {
		const records = parse(input, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		});
		return { ok: true, data: records };
	} catch (err) {
		return { ok: false, error: `CSV parse error: ${err.message}` };
	}
}

/**
 * Convert JSON to YAML.
 * @param {object} data - JSON data
 * @param {number} [indent=2] - Indentation
 * @returns {object} YAML result
 */
function jsonToYaml(data, indent = 2) {
	try {
		const yaml = dumpYaml(data, { indent, lineWidth: 100 });
		return { ok: true, data: yaml };
	} catch (err) {
		return { ok: false, error: `JSON to YAML error: ${err.message}` };
	}
}

/**
 * Convert YAML to JSON.
 * @param {string} input - YAML string
 * @returns {object} JSON result
 */
function yamlToJson(input) {
	if (!input || typeof input !== "string") {
		return { ok: false, error: "Input must be a non-empty YAML string" };
	}
	try {
		const parsed = loadYaml(input);
		return { ok: true, data: JSON.stringify(parsed, null, 2) };
	} catch (err) {
		return { ok: false, error: `YAML to JSON error: ${err.message}` };
	}
}

/**
 * Apply field mapping to data.
 * @param {object|object[]} data - Data to transform
 * @param {object} mapping - Mapping rules
 * @returns {object} Transformed result
 */
function applyMapping(data, mapping) {
	if (!mapping) return { ok: true, data };

	if (Array.isArray(data)) {
		const results = data.map((item) => {
			const result = { ...item };
			if (mapping.renames) {
				for (const [from, to] of Object.entries(mapping.renames)) {
					if (result[from] !== undefined) {
						result[to] = result[from];
						delete result[from];
					}
				}
			}
			if (mapping.additions) {
				Object.assign(result, mapping.additions);
			}
			if (mapping.removals) {
				for (const field of mapping.removals) {
					delete result[field];
				}
			}
			return result;
		});
		return { ok: true, data: results };
	}

	return transformJson(data, mapping);
}

/**
 * Execute data manipulation/transformation action.
 * @param {z.infer<typeof DataToolSchema>} input - Tool input
 * @returns {Promise<object>} Result object
 */
export async function dataTool(input) {
	const { action } = input;

	switch (action) {
		// JSON actions
		case "parse": {
			return parseJson(input.input);
		}
		case "serialize": {
			return serializeJson(input.data, input.indent);
		}
		case "filter": {
			if (!input.input) return { ok: false, error: "input is required for filter action" };
			const parseResult = parseJson(input.input);
			if (!parseResult.ok) return parseResult;
			return filterJson(parseResult.data, input.path);
		}
		case "transform": {
			if (!input.data) return { ok: false, error: "data is required for transform action" };
			return transformJson(input.data, input.mapping);
		}
		case "validate": {
			if (!input.input) return { ok: false, error: "input is required for validate action" };
			if (!input.schema) return { ok: false, error: "schema is required for validate action" };
			const parseResult = parseJson(input.input);
			if (!parseResult.ok) return parseResult;
			return validateJson(parseResult.data, input.schema);
		}

		// YAML actions
		case "yamlParse": {
			return parseYaml(input.input);
		}
		case "yamlSerialize": {
			return serializeYaml(input.data, input.indent);
		}
		case "yamlPath": {
			if (!input.input) return { ok: false, error: "input is required for yamlPath action" };
			const parseResult = parseYaml(input.input);
			if (!parseResult.ok) return parseResult;
			return accessYamlPath(parseResult.data, input.path);
		}
		case "yamlTransform": {
			if (!input.input) return { ok: false, error: "input is required for yamlTransform action" };
			const parseResult = parseYaml(input.input);
			if (!parseResult.ok) return parseResult;
			return transformYaml(parseResult.data, input.mapping);
		}
		case "yamlValidate": {
			if (!input.input) return { ok: false, error: "input is required for yamlValidate action" };
			if (!input.schema) return { ok: false, error: "schema is required for yamlValidate action" };
			const parseResult = parseYaml(input.input);
			if (!parseResult.ok) return parseResult;
			return validateYaml(parseResult.data, input.schema);
		}

		// Data transformation actions
		case "jsonToCsv": {
			if (!input.input) return { ok: false, error: "input is required for jsonToCsv action" };
			const parseResult = parseJson(input.input);
			if (!parseResult.ok) return parseResult;
			return jsonToCsv(parseResult.data, input.mapping);
		}
		case "csvToJson": {
			return csvToJson(input.input);
		}
		case "jsonToYaml": {
			if (!input.input) return { ok: false, error: "input is required for jsonToYaml action" };
			const parseResult = parseJson(input.input);
			if (!parseResult.ok) return parseResult;
			return jsonToYaml(parseResult.data, input.indent);
		}
		case "yamlToJson": {
			return yamlToJson(input.input);
		}
		case "mapFields": {
			if (!input.input) return { ok: false, error: "input is required for mapFields action" };
			// Try JSON first, then YAML
			let parsed;
			let isJson = false;
			try {
				parsed = JSON.parse(input.input);
				isJson = true;
			} catch (_err) {
				try {
					parsed = loadYaml(input.input);
					isJson = false;
				} catch (_err2) {
					return { ok: false, error: "Input is neither valid JSON nor YAML" };
				}
			}
			const result = applyMapping(parsed, input.mapping);
			if (!result.ok) return result;
			// Return in the same format
			return isJson
				? { ok: true, data: JSON.stringify(result.data, null, 2) }
				: { ok: true, data: stringify(result.data, { indent: 2, lineWidth: 100 }) };
		}

		default:
			return {
				ok: false,
				error: `Unknown action: "${action}". Valid actions: parse, serialize, filter, transform, validate, yamlParse, yamlSerialize, yamlPath, yamlTransform, yamlValidate, jsonToCsv, csvToJson, jsonToYaml, yamlToJson, mapFields`,
			};
	}
}

/**
 * Data manipulation tool — JSON, YAML, CSV parsing, filtering, transformation, and conversion.
 */
export const dataToolTool = tool(dataTool, {
	name: "dataTool",
	description:
		"Manipulate structured data: parse/serialize JSON/YAML, JSONPath filtering, field mapping, and format conversion (JSON↔CSV, JSON↔YAML).",
	schema: DataToolSchema,
});
