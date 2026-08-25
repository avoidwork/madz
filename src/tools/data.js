import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { load, dump } from "js-yaml";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

/**
 * Convert JSON string to YAML string.
 * @param {string} input - JSON string
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function jsonToYaml(input) {
	let obj;
	try {
		obj = JSON.parse(input);
	} catch (err) {
		return { ok: false, error: `Invalid JSON input: ${err.message}` };
	}
	return { ok: true, data: dump(obj, { indent: 2 }) };
}

/**
 * Convert YAML string to JSON string.
 * @param {string} input - YAML string
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function yamlToJson(input) {
	let data;
	try {
		data = load(input);
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
	}
	return { ok: true, data: JSON.stringify(data, null, 2) };
}

/**
 * Convert JSON string to CSV string.
 * @param {string} input - JSON string (array of objects or single object)
 * @param {string} [mapping] - JSON string mapping rules
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function jsonToCsv(input, mapping) {
	let obj;
	try {
		obj = JSON.parse(input);
	} catch (err) {
		return { ok: false, error: `Invalid JSON input: ${err.message}` };
	}

	const records = Array.isArray(obj) ? obj : [obj];

	let mapped = records;
	if (mapping) {
		let rules;
		try {
			rules = JSON.parse(mapping);
		} catch (err) {
			return { ok: false, error: `Invalid mapping JSON: ${err.message}` };
		}
		mapped = records.map((record) => {
			const row = {};
			for (const [newKey, oldKey] of Object.entries(rules)) {
				if (typeof oldKey === "string" && oldKey in record) {
					row[newKey] = record[oldKey];
				}
			}
			return row;
		});
	}

	const headers = mapped.length > 0 ? Object.keys(mapped[0]) : [];
	return { ok: true, data: stringify(mapped, { header: true, columns: headers }) };
}

/**
 * Convert CSV string to JSON array.
 * @param {string} input - CSV string
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function csvToJson(input) {
	let records;
	try {
		records = parse(input, { columns: true, relax_columns: true });
	} catch (err) {
		return { ok: false, error: `CSV parse error: ${err.message}` };
	}
	return { ok: true, data: JSON.stringify(records, null, 2) };
}

/**
 * Convert YAML string to CSV string.
 * @param {string} input - YAML string
 * @param {string} [mapping] - JSON string mapping rules
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function yamlToCsv(input, mapping) {
	let data;
	try {
		data = load(input);
	} catch (err) {
		return { ok: false, error: `YAML parse error: ${err.message}` };
	}

	if (Array.isArray(data)) {
		return jsonToCsv(JSON.stringify(data), mapping);
	}
	if (typeof data === "object" && data !== null) {
		return jsonToCsv(JSON.stringify([data]), mapping);
	}
	return { ok: false, error: "YAML must contain an object or array for CSV conversion" };
}

/**
 * Convert CSV string to YAML string.
 * @param {string} input - CSV string
 * @returns {{ ok: boolean, data?: string, error?: string }}
 */
function csvToYaml(input) {
	let records;
	try {
		records = parse(input, { columns: true, relax_columns: true });
	} catch (err) {
		return { ok: false, error: `CSV parse error: ${err.message}` };
	}
	return { ok: true, data: dump(records, { indent: 2 }) };
}

/**
 * Validate input format.
 * @param {string} input - String to validate
 * @param {string} format - Expected format
 * @returns {{ ok: boolean, error?: string }}
 */
function validateFormat(input, format) {
	if (!input || typeof input !== "string") {
		return { ok: false, error: "Input must be a non-empty string" };
	}
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: "Input must be a non-empty string" };
	}

	switch (format) {
		case "json":
			try {
				JSON.parse(trimmed);
				return { ok: true };
			} catch {
				return { ok: false, error: "Invalid JSON input" };
			}
		case "yaml":
			try {
				load(trimmed);
				return { ok: true };
			} catch {
				return { ok: false, error: "Invalid YAML input" };
			}
		case "csv":
			try {
				parse(trimmed, { columns: true, relax_columns: true });
				return { ok: true };
			} catch {
				return { ok: false, error: "Invalid CSV input" };
			}
		default:
			return { ok: false, error: `Unsupported format: ${format}` };
	}
}

/**
 * Data transformation tool — convert between JSON, YAML, and CSV formats.
 * @param {string} input - JSON string with action, input, format, mapping
 * @returns {Promise<{ ok: boolean, data?: string, error?: string }>}
 */
export async function dataTransformation(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return dataTransformationImpl(parsed);
}

/**
 * Data transformation implementation — takes a plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, data?: string, error?: string }>}
 */
export async function dataTransformationImpl(input) {
	const schema = z.object({
		action: z
			.enum([
				"json-to-yaml",
				"yaml-to-json",
				"json-to-csv",
				"csv-to-json",
				"yaml-to-csv",
				"csv-to-yaml",
			])
			.describe("Conversion action"),
		input: z.string().describe("Input data string"),
		format: z.enum(["json", "yaml", "csv"]).describe("Input format"),
		mapping: z.string().optional().describe("JSON string mapping rules for CSV conversions"),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const { action, input: dataInput, format, mapping } = validated.data;

	// Validate input format
	const validation = validateFormat(dataInput, format);
	if (!validation.ok) {
		return validation;
	}

	switch (action) {
		case "json-to-yaml":
			return jsonToYaml(dataInput);
		case "yaml-to-json":
			return yamlToJson(dataInput);
		case "json-to-csv":
			return jsonToCsv(dataInput, mapping);
		case "csv-to-json":
			return csvToJson(dataInput);
		case "yaml-to-csv":
			return yamlToCsv(dataInput, mapping);
		case "csv-to-yaml":
			return csvToYaml(dataInput);
		default:
			return { ok: false, error: `Unknown action: ${action}` };
	}
}

/**
 * Create the LangChain tool wrapper for data transformation.
 * @returns {object} LangChain Tool instance
 */
export function createDataTool() {
	return tool(
		async (input) => {
			const result = await dataTransformation(input);
			return JSON.stringify(result, null, 2);
		},
		{
			name: "data",
			description:
				"Convert data between JSON, YAML, and CSV formats. Actions: json-to-yaml, yaml-to-json, json-to-csv, csv-to-json, yaml-to-csv, csv-to-yaml. CSV conversions support optional mapping rules (JSON string) to rename columns.",
			schema: z.object({
				action: z
					.enum([
						"json-to-yaml",
						"yaml-to-json",
						"json-to-csv",
						"csv-to-json",
						"yaml-to-csv",
						"csv-to-yaml",
					])
					.describe("Conversion action"),
				input: z.string().describe("Input data string"),
				format: z.enum(["json", "yaml", "csv"]).describe("Input format"),
				mapping: z.string().optional().describe("JSON string mapping rules for CSV conversions"),
			}),
		},
	);
}
