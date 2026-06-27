import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ConfigSchema, DEFAULT_CONFIG } from "./schemas.js";
import { applyDotPathMutation } from "./mutate.js";

const _require = createRequire(import.meta.url);
const yaml = await import("js-yaml");

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(PROJECT_ROOT, "../../config.yaml");

/// -- Convert camelCase or kebab-case to SNAKE_CASE ---

/**
 * @param {string} str - Config key like "maxConcurrent" or "openai"
 * @returns {string}
 */
function _toUpperSnake(str) {
	// Insert underscore before each uppercase letter preceded by lowercase
	return str
		.split("")
		.reduce((acc, ch) => {
			if (/[A-Z]/.test(ch)) {
				return acc + "_" + ch;
			}
			return acc + ch;
		}, "")
		.replace(/^_/, "")
		.toUpperCase();
}

/// -- Parse a value string into the correct JS type ---

function _parseValue(str) {
	if (str === "true") return true;
	if (str === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
	return str;
}

/// -- Recursive env-var resolver

/**
 * Resolve leaf values from environment variables.
 * Maps config paths to env vars that make sense to users:
 *   providers.openai.credentials.apiKey        → OPENAI_API_KEY
 *   sandbox.timeout.seconds                    → SANDBOX_SECONDS
 * @param {unknown} node - Config node to walk
 * @param {string[]} path - Dot-path segments accumulated during recursion
 * @returns {unknown}
 */
export function _resolveEnvRecursively(node, path) {
	// These container keys should not appear in the env var name
	const DROPPED_KEYS = [
		"providers", // e.g. providers.openai.credentials.apiKey → OPENAI_API_KEY
		"credentials",
		"ratelimit",
		"timeout",
		"search", // e.g. search.exa.apiKey → EXA_API_KEY
	];

	if (Array.isArray(node)) {
		return node.map((item, idx) => {
			return _resolveEnvRecursively(item, [...path, String(idx)]);
		});
	}
	if (typeof node === "object" && node !== null) {
		const result = {};
		for (const [key, value] of Object.entries(node)) {
			const child = [...path, key];
			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				result[key] = _resolveEnvRecursively(value, child);
				continue;
			}

			// Drop 'providers', 'credentials', 'rateLimit', and 'timeout' container keys; keep section names
			const envPath = child.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
			const envKey = envPath.map(_toUpperSnake).join("_");

			const envValue = process.env[envKey];
			if (envValue !== undefined) {
				result[key] = _parseValue(envValue);
			} else if (typeof value === "string" && value.match(/^\$\{[A-Z_]+\}$/)) {
				const legacy = value.slice(2, -1);
				const legacyValue = process.env[legacy];
				result[key] = legacyValue !== undefined ? legacyValue : value;
			} else {
				result[key] = value;
			}
		}
		return result;
	}
	return node;
}

/// -- Deep merge ---

/**
 * Deep merge source into target (mutates target).
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
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

// Module-level cache for loadConfig
let cachedConfig = null;

/**
 * Load, parse, validate, merge defaults, and return.
 * Resolves env vars by mapping each config path segment to an
 * environment variable name: providers.openai.credentials.apiKey
 * resolves to OPENAI_API_KEY.
 * Cached after first call — subsequent calls return the same object.
 * @param {boolean} [subAgent=false] - Whether running as a sub-agent
 * @returns {z.infer<typeof ConfigSchema>}
 */
export function loadConfig(subAgent = false) {
	if (cachedConfig) {
		if (subAgent) {
			cachedConfig.subAgent = true;
		}
		return cachedConfig;
	}

	let raw = DEFAULT_CONFIG;
	if (existsSync(CONFIG_PATH)) {
		const fileContent = readFileSync(CONFIG_PATH, "utf-8");
		const parsed = yaml.load(fileContent);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			raw = deepMerge({}, { ...DEFAULT_CONFIG, ...parsed });
		}
	}
	const resolved = _resolveEnvRecursively(raw, []);
	const config = validateConfig(resolved);
	// Capture the original working directory before any chdir happens
	config.cwd = process.cwd();
	config.subAgent = subAgent;
	if (subAgent) {
		config.sandbox.paths.push(config.cwd);
	}
	cachedConfig = config;
	return config;
}

/**
 * Save current config to config.yaml.
 * @param {Object} config
 */
export function saveConfig(config) {
	const dir = dirname(CONFIG_PATH);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const yamlContent = yaml.dump(config);
	writeFileSync(CONFIG_PATH, yamlContent);
}

/**
 * Runtime mutation: set a dot-path value, validate, and persist.
 * @param {Object} config
 * @param {string} dotPath - Dotted config path
 * @param {string} valueStr - String value to parse and save
 * @returns {boolean} Success
 */
export function setConfigValue(config, dotPath, valueStr) {
	applyDotPathMutation(config, dotPath, valueStr);
	saveConfig(config);
	return true;
}
