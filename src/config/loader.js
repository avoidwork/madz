import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { ConfigSchema, DEFAULT_CONFIG } from "./schemas.js";

const _require = createRequire(import.meta.url);
const yaml = await import("js-yaml");

const PROJECT_ROOT = process.cwd();
const CONFIG_PATH = join(PROJECT_ROOT, "config.yaml");

// Expand env vars in a value recursively
function expandEnvVars(value) {
	if (typeof value === "string" && value.match(/^\$\{[A-Z_]+\}$/)) {
		const key = value.replace(/^\${/, "").replace(/}$/, "");
		return process.env[key] || value;
	}
	if (typeof value === "object" && value !== null) {
		if (Array.isArray(value)) {
			return value.map(expandEnvVars);
		}
		const result = {};
		for (const [k, v] of Object.entries(value)) {
			result[k] = expandEnvVars(v);
		}
		return result;
	}
	return value;
}

// Deep merge sources into targets (mutates target)
function deepMerge(target, source) {
	for (const [key, value] of Object.entries(source)) {
		if (
			value !== undefined &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			target[key] !== undefined &&
			typeof target[key] === "object"
		) {
			deepMerge(target[key], value);
		} else {
			target[key] = value;
		}
	}
	return target;
}

// Validate raw config object against schema
function validateConfig(raw) {
	return ConfigSchema.parse(raw);
}

// Load, parse, validate, merge defaults, and return
export function loadConfig() {
	let raw = DEFAULT_CONFIG;
	if (existsSync(CONFIG_PATH)) {
		const fileContent = readFileSync(CONFIG_PATH, "utf-8");
		const parsed = yaml.load(fileContent);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			raw = deepMerge({}, { ...DEFAULT_CONFIG, ...parsed });
		}
	}
	const expanded = expandEnvVars(raw);
	return validateConfig(expanded);
}

// Dot-path accessor: get value at config.telemetry.sampling.ratio
function _resolvePath(obj, path) {
	const keys = path.split(".");
	let current = obj;
	for (const key of keys) {
		if (current === undefined || current === null) return undefined;
		current = current[key];
	}
	return current;
}

// Dot-path mutator: set config.telemetry.sampling.ratio = 0.5
function assignPath(obj, path, value) {
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

// Parse a value string into the correct JS type
function parseValue(str) {
	if (str === "true") return true;
	if (str === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
	return str;
}

// Save current config to config.yaml
export function saveConfig(config) {
	const dir = dirname(CONFIG_PATH);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const yamlContent = yaml.dump(config);
	writeFileSync(CONFIG_PATH, yamlContent);
}

// Runtime mutation: set a dot-path value, validate, and persist
export function setConfigValue(config, dotPath, valueStr) {
	const value = parseValue(valueStr);
	// Apply mutation to a deep copy
	const patched = structuredClone(config);
	assignPath(patched, dotPath, value);
	// Validate the patched config
	ConfigSchema.parse(patched);
	// Apply to original config
	assignPath(config, dotPath, value);
	// Persist to disk
	saveConfig(config);
	return true;
}
