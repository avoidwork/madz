import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ConfigSchema, _setResolvedConfig } from "./config.js";
import { applyDotPathMutation } from "./patch.js";

const _require = createRequire(import.meta.url);
import { load, dump } from "js-yaml";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(PROJECT_ROOT, "../../config.yaml");

/// -- Convert camelCase or kebab-case to SNAKE_CASE ---

/**
 * @param {string} str - Config key like "maxConcurrent" or "openai"
 * @returns {string}
 */
function _toUpperSnake(str) {
	// Convert hyphens to underscores before the camelCase → SNAKE_CASE conversion
	// so agent names like "code-review" produce CODE_REVIEW env vars
	str = str.replace(/-/g, "_");
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

/// -- Known config sections (top-level keys from ConfigSchema minus cwd)
const KNOWN_SECTIONS = [
	"providers",
	"email",
	"calendar",
	"sandbox",
	"search",
	"memory",
	"telemetry",
	"schedules",
	"tui",
	"agent",
	"lru",
	"persistence",
	"skillAgentMap",
	"subAgentsTemperature",
	"vector",
];

/// -- Apply a dot-path value to an object, materializing intermediate structure

/**
 * Set a value at a dot-path in an object, creating intermediate objects or arrays as needed.
 * Handles numeric path segments as array indices.
 * Mutates the target object in place.
 * @param {Object} obj - Target object to mutate
 * @param {string} dotPath - Dot-separated path (e.g., "vector.projects.projectAlpha.include.0")
 * @param {unknown} value - Value to set at the path
 */
export function applyDotPath(obj, dotPath, value) {
	const keys = dotPath.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		const nextKey = keys[i + 1];
		const isNextNumeric = /^\d+$/.test(nextKey);
		if (current[key] === undefined || current[key] === null) {
			current[key] = isNextNumeric ? [] : {};
		}
		// If the current key is a numeric index but current is not an array, coerce
		if (/^\d+$/.test(key) && !Array.isArray(current)) {
			const arr = [];
			const idx = Number(key);
			arr[idx] = current[key] || {};
			current = arr;
			// Re-assign the array back to parent
			const parentKey = keys[i - 1];
			if (parentKey !== undefined) {
				obj[parentKey] = current;
			}
		}
		current = current[key];
	}
	current[keys[keys.length - 1]] = value;
}

/// -- Schema-driven reverse mapping

/**
 * Walk a Zod schema recursively to enumerate all valid leaf paths and compute
 * their environment variable names using the same DROPPED_KEYS logic as
 * _resolveEnvRecursively. Returns a Map of env-var-name → dot-path.
 *
 * This solves the ambiguous kebab-case/camelCase conversion problem: instead of
 * guessing whether PROJECT_ALPHA maps to "project-alpha" or "projectAlpha", we
 * derive the exact path from the schema definition.
 *
 * @param {import("zod").ZodType} schema - Zod schema to introspect
 * @param {string[]} [path] - Current dot-path segments (for recursion)
 * @param {Map<string, string>} [map] - Accumulator map (for recursion)
 * @returns {Map<string, string>}
 */
export function buildReverseMap(schema, path = [], map = new Map()) {
	const DROPPED_KEYS = [
		"providers",
		"credentials",
		"ratelimit",
		"timeout",
		"search",
		"process",
		"calendar",
		"subagentstemperature",
	];

	const def = schema._def;
	if (!def || !def.type) {
		// Unknown schema type — treat as leaf if we have a path
		if (path.length > 0) {
			const envPath = path.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
			const envKey = envPath.map(_toUpperSnake).join("_");
			map.set(envKey, path.join("."));
		}
		return map;
	}

	const type = def.type;

	// Object schemas — recurse into each property
	if (type === "object" && schema.shape) {
		for (const [key, childSchema] of Object.entries(schema.shape)) {
			buildReverseMap(childSchema, [...path, key], map);
		}
		return map;
	}

	// Record schemas (e.g., providers: z.object({}).passthrough(), vector.projects: z.record(...))
	if (type === "record") {
		// Records have dynamic keys — we cannot enumerate them statically.
		// The value schema tells us the shape of each entry.
		// We skip record value schemas since keys are unknown at build time.
		// syncEnv() handles record entries via the prefix allowlist + reverse map lookup.
		return map;
	}

	// Array schemas
	if (type === "array") {
		// Register the base array path (without index) so syncEnv can match
		// env vars with numeric suffixes like SANDBOX_PATHS_0, SANDBOX_PATHS_1
		if (path.length > 0) {
			const envPath = path.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
			const envKey = envPath.map(_toUpperSnake).join("_");
			map.set(envKey, path.join("."));
		}
		return map;
	}

	// Optional / defaultable / nullable wrappers — unwrap and recurse
	if (type === "optional" || type === "default" || type === "nullable") {
		if (def.innerType) {
			buildReverseMap(def.innerType, path, map);
		}
		return map;
	}

	// Effects (e.g., .transform, .preprocess) — unwrap
	if (type === "effects") {
		if (def.schema) {
			buildReverseMap(def.schema, path, map);
		}
		return map;
	}

	// Union — recurse into each variant
	if (type === "union" && def.options) {
		for (const option of def.options) {
			buildReverseMap(option, path, map);
		}
		return map;
	}

	// Discriminated union
	if (type === "discriminatedUnion" && def.optionsMap) {
		for (const option of Object.values(def.optionsMap)) {
			buildReverseMap(option, path, map);
		}
		return map;
	}

	// Literal / enum — these are leaf values
	if (type === "literal" || type === "enum") {
		if (path.length > 0) {
			const envPath = path.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
			const envKey = envPath.map(_toUpperSnake).join("_");
			map.set(envKey, path.join("."));
		}
		return map;
	}

	// Leaf types: string, number, boolean, bigint, date, etc.
	if (path.length > 0) {
		const envPath = path.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
		const envKey = envPath.map(_toUpperSnake).join("_");
		map.set(envKey, path.join("."));
	}

	return map;
}

/// -- Sync env vars into config

/**
 * Scan process.env for keys matching known config section prefixes and
 * materialize any missing config structure (objects, arrays) into the raw
 * config object. Runs after YAML parse and before _resolveEnvRecursively().
 *
 * Uses the schema-driven reverse map to resolve env-var names to config paths,
 * solving the ambiguous kebab-case/camelCase conversion problem.
 *
 * Idempotent: only creates missing structure; never overrides existing YAML keys.
 *
 * @param {Object} raw - Raw config object (mutated in place)
 * @param {string[]} knownSections - Top-level config section names to allowlist
 * @param {Map<string, string>} reverseMap - Env-var-name → dot-path map from buildReverseMap()
 */
export function syncEnv(raw, knownSections, reverseMap) {
	for (const [envKey, envValue] of Object.entries(process.env)) {
		// Check prefix allowlist
		const topLevel = envKey.split("_")[0].toLowerCase();
		if (!knownSections.some((s) => s.toLowerCase() === topLevel)) {
			continue;
		}

		// Look up in reverse map — try exact match first, then strip numeric suffixes
		// for array elements (e.g., SANDBOX_PATHS_0 → strip _0 → SANDBOX_PATHS)
		let dotPath = reverseMap.get(envKey);
		let arrayIndex = -1;
		if (!dotPath) {
			// Try stripping trailing numeric segments to find a matching array path
			const segments = envKey.split("_");
			for (let i = segments.length - 1; i >= 0; i--) {
				if (/^\d+$/.test(segments[i])) {
					const baseKey = segments.slice(0, i).join("_");
					const basePath = reverseMap.get(baseKey);
					if (basePath) {
						dotPath = basePath + "." + segments[i];
						arrayIndex = Number(segments[i]);
						break;
					}
				} else {
					break;
				}
			}
		}
		if (!dotPath) {
			continue;
		}

		// Check if the path already exists in raw config (idempotent)
		const keys = dotPath.split(".");
		let existing = raw;
		let exists = true;
		for (const key of keys) {
			if (existing === undefined || existing === null || !(key in existing)) {
				exists = false;
				break;
			}
			existing = existing[key];
		}
		if (exists) {
			continue;
		}

		// Materialize the path
		const parsed = _parseValue(envValue);
		applyDotPath(raw, dotPath, parsed);
	}
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
		"process",
		"calendar", // e.g. calendar.google.apiKey → GOOGLE_CALENDAR_API_KEY
		"subagentstemperature", // e.g. subAgentsTemperature.coding → SUB_AGENTS_TEMPERATURE_CODING
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

			// Handle nested arrays — recurse into each element
			if (Array.isArray(value)) {
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
 * @returns {z.infer<typeof ConfigSchema>}
 */
export function loadConfig() {
	if (cachedConfig) {
		return cachedConfig;
	}

	let raw = ConfigSchema.parse({});
	if (existsSync(CONFIG_PATH)) {
		const fileContent = readFileSync(CONFIG_PATH, "utf-8");
		const parsed = load(fileContent);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			raw = deepMerge({}, { ...ConfigSchema.parse({}), ...parsed });
		}
	}
	// Materialize missing config structure from environment variables
	// before the recursive resolver runs. This makes env vars a first-class
	// config source — they can define new config paths, not just override
	// existing YAML keys.
	const reverseMap = buildReverseMap(ConfigSchema);
	syncEnv(raw, KNOWN_SECTIONS, reverseMap);
	const resolved = _resolveEnvRecursively(raw, []);
	const config = validateConfig(resolved);
	// Capture the original working directory before any chdir happens
	config.cwd = process.cwd();
	cachedConfig = config;
	_setResolvedConfig(config);
	return config;
}

/**
 * Save current config to config.yaml.
 * @param {Object} config
 */
export function saveConfig(config) {
	const dir = dirname(CONFIG_PATH);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const yamlContent = dump(config);
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
