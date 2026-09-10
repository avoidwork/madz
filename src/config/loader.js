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

// These container keys should not appear in the env var name.
// Must be kept in sync with the DROPPED_KEYS list in _resolveEnvRecursively.
const DROPPED_KEYS = [
	"providers",
	"credentials",
	"ratelimit",
	"timeout",
	"search",
	"process",
	"calendar",
	"subAgentstemperature", // lowercase version of "subAgentsTemperature"
];

// Cache for the schema-driven reverse map (built once)
let _reverseMapCache = null;

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

/// -- applyDotPath: materialize intermediate objects/arrays ---

/**
 * Materialize a value at a dot-path in an object, creating intermediate
 * objects and arrays as needed. Numeric segments create/extend arrays.
 * Never overwrites existing values (idempotent).
 * @param {Object} obj - Target object to mutate
 * @param {string} dotPath - Dot-separated path (e.g., "a.b.0.c")
 * @param {unknown} value - Value to set at the leaf
 * @returns {boolean} True if the value was set (path was missing), false if already existed
 */
export function applyDotPath(obj, dotPath, value) {
	const keys = dotPath.split(".");
	let current = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		const nextKey = keys[i + 1];
		const isNextNumeric = /^\d+$/.test(nextKey);

		// If the current key is numeric, ensure we're working with an array
		if (/^\d+$/.test(key)) {
			const idx = Number(key);
			if (!Array.isArray(current)) {
				return false; // Can't index into non-array
			}
			// Fill gaps with null
			while (current.length <= idx) {
				current.push(null);
			}
			if (current[idx] === null || current[idx] === undefined) {
				current[idx] = isNextNumeric ? [] : {};
			}
			current = current[idx];
		} else {
			// Object key
			if (current[key] === undefined || current[key] === null) {
				current[key] = isNextNumeric ? [] : {};
			}
			if (typeof current[key] !== "object" || current[key] === null) {
				return false; // Can't descend into non-object
			}
			current = current[key];
		}
	}

	// Set the leaf value — but only if it doesn't already exist (idempotent)
	const lastKey = keys[keys.length - 1];
	if (/^\d+$/.test(lastKey)) {
		const idx = Number(lastKey);
		if (!Array.isArray(current)) {
			return false;
		}
		while (current.length <= idx) {
			current.push(null);
		}
		if (current[idx] === undefined || current[idx] === null) {
			current[idx] = value;
			return true;
		}
		return false; // Already exists
	}

	if (current[lastKey] === undefined || current[lastKey] === null || current[lastKey] === "") {
		current[lastKey] = value;
		return true;
	}
	return false; // Already exists (idempotent)
}

/// -- Schema-driven reverse mapping ---

/**
 * Get the inner type name from a Zod schema, unwrapping optional/default wrappers.
 * In Zod v4, type names are lowercase strings (e.g., "object", "string", "array").
 * @param {import("zod").ZodType} schema
 * @returns {import("zod").ZodType|null}
 */
function _getInnerType(schema) {
	if (!schema || !schema._def) return null;
	let inner = schema;
	// Unwrap optional/default wrappers (Zod v4 uses lowercase type names)
	while (
		inner._def &&
		(inner._def.type === "optional" ||
			inner._def.type === "default" ||
			inner._def.type === "nullable")
	) {
		inner = inner._def.innerType;
		if (!inner || !inner._def) return null;
	}
	return inner;
}

/**
 * Walk a Zod object schema recursively to enumerate all valid leaf paths
 * and build a reverse map from env-var name → dot-path.
 *
 * This accounts for DROPPED_KEYS containers implicitly because the schema
 * already encodes the full path (e.g., providers.openai.credentials.apiKey).
 *
 * For record types (z.record()), the map stores a special marker entry
 * with the key `__record__:<envPrefix>` → `<dotPrefix>` so that syncEnv()
 * can match dynamic keys at runtime.
 *
 * @param {import("zod").ZodObject} schema - Zod schema to introspect
 * @param {string[]} [path] - Current path segments (internal recursion)
 * @param {Map<string, string>} [map] - Accumulator map (internal recursion)
 * @returns {Map<string, string>} env-var name → dot-path
 */
export function buildReverseMap(schema, path = [], map = new Map()) {
	const shape = schema?._def?.shape;
	if (!shape || typeof shape !== "object") return map;

	for (const [key, fieldSchema] of Object.entries(shape)) {
		const currentPath = [...path, key];
		const inner = _getInnerType(fieldSchema);
		if (!inner || !inner._def) continue;

		const typeName = inner._def.type;

		if (typeName === "object") {
			// Recurse into nested objects
			buildReverseMap(inner, currentPath, map);
		} else if (typeName === "array") {
			// Arrays: register the path without index (env vars use _0, _1, etc.)
			const elementSchema = inner._def.element;
			const elementType = _getInnerType(elementSchema);
			if (elementType && elementType._def && elementType._def.type === "object") {
				buildReverseMap(elementType, currentPath, map);
			} else {
				// Primitive array — register the path
				const envName = _pathToEnvName(currentPath);
				map.set(envName, currentPath.join("."));
			}
		} else if (typeName === "record") {
			// Records (e.g., z.record(VectorProjectSchema)): register a pattern marker
			// so syncEnv() can match dynamic keys at runtime.
			const envPrefix = _pathToEnvName(currentPath);
			const dotPrefix = currentPath.join(".");
			map.set(`__record__:${envPrefix}`, dotPrefix);

			// Recurse into the value schema to register static sub-path templates.
			// These are stored as __subpath__:<envPrefix> → <dotSuffix> entries
			// so syncEnv() can reconstruct the full dot-path for dynamic keys.
			const valueSchema = _getInnerType(inner._def.valueType);
			if (valueSchema && valueSchema._def && valueSchema._def.type === "object") {
				const subMap = new Map();
				buildReverseMap(valueSchema, [], subMap);
				for (const [subEnvName, subDotPath] of subMap) {
					// Store the sub-path template relative to the record
					map.set(`__subpath__:${envPrefix}:${subEnvName}`, subDotPath);
				}
			}
		} else if (typeName === "enum") {
			const envName = _pathToEnvName(currentPath);
			map.set(envName, currentPath.join("."));
		} else if (typeName === "string" || typeName === "number" || typeName === "boolean") {
			const envName = _pathToEnvName(currentPath);
			map.set(envName, currentPath.join("."));
		} else if (typeName === "literal") {
			const envName = _pathToEnvName(currentPath);
			map.set(envName, currentPath.join("."));
		} else if (typeName === "union" || typeName === "effects") {
			// Unions and effects: try to extract inner types
			const options = inner._def.options || (typeName === "effects" ? [inner._def.schema] : []);
			if (options) {
				for (const opt of options) {
					const optInner = _getInnerType(opt);
					if (optInner && optInner._def && optInner._def.type === "object") {
						buildReverseMap(optInner, currentPath, map);
					}
				}
			}
		}
	}

	return map;
}

/**
 * Convert a config path (array of segments) to an env-var name,
 * applying the same DROPPED_KEYS filtering as _resolveEnvRecursively.
 * @param {string[]} path
 * @returns {string}
 */
function _pathToEnvName(path) {
	const filtered = path.filter((p) => !DROPPED_KEYS.includes(p.toLowerCase()));
	return filtered.map(_toUpperSnake).join("_");
}

/// -- syncEnv: materialize config from environment variables ---

/**
 * Known top-level config sections derived from ConfigSchema.
 * Used as a prefix allowlist to prevent system env vars from leaking in.
 */
export const KNOWN_SECTIONS = Object.keys(ConfigSchema._def?.shape ?? {}).filter(
	(k) => k !== "cwd", // cwd is runtime-only, not a config section
);

/**
 * Scan process.env for keys matching known config section prefixes and
 * materialize any missing structure (objects, arrays) into the raw config object.
 *
 * Uses a schema-driven reverse map to resolve env-var names back to config paths,
 * accounting for DROPPED_KEYS containers implicitly.
 *
 * For env vars not found in the reverse map (e.g., dynamic record keys like
 * vector.projects.<name>), pattern markers from the reverse map are used to
 * derive the correct dot-path.
 *
 * Idempotent — never overrides existing YAML keys.
 *
 * @param {Object} raw - Raw config object (mutated in place)
 * @param {string[]} knownSections - Prefix allowlist (top-level config sections)
 * @returns {Object} The mutated raw config (same reference)
 */
export function syncEnv(raw, knownSections = KNOWN_SECTIONS) {
	// Build or retrieve the cached reverse map
	if (!_reverseMapCache) {
		_reverseMapCache = buildReverseMap(ConfigSchema);
	}

	const reverseMap = _reverseMapCache;

	// Build prefix allowlist from known sections (UPPER_SNAKE form)
	const prefixSet = new Set(knownSections.map((s) => _toUpperSnake(s)));

	// Also add prefixes from the reverse map — these account for DROPPED_KEYS
	// where the first env-var segment differs from the section name.
	for (const envName of reverseMap.keys()) {
		if (envName.startsWith("__record__:")) continue;
		prefixSet.add(envName.split("_")[0]);
	}

	// Collect record pattern markers for dynamic key matching.
	// __record__:<envPrefix> → <dotPrefix> marks a z.record() container.
	// __subpath__:<envPrefix>:<subEnvName> → <subDotPath> marks sub-paths
	// within the record's value schema.
	const recordPatterns = [];
	const subPathTemplates = new Map();
	for (const [key, value] of reverseMap) {
		if (key.startsWith("__record__:")) {
			recordPatterns.push({
				envPrefix: key.slice("__record__:".length),
				dotPrefix: value,
			});
		} else if (key.startsWith("__subpath__:")) {
			// key format: __subpath__:<envPrefix>:<subEnvName>
			const rest = key.slice("__subpath__:".length);
			const colonIdx = rest.indexOf(":");
			if (colonIdx > 0) {
				const envPrefix = rest.slice(0, colonIdx);
				const subEnvName = rest.slice(colonIdx + 1);
				if (!subPathTemplates.has(envPrefix)) {
					subPathTemplates.set(envPrefix, new Map());
				}
				subPathTemplates.get(envPrefix).set(subEnvName, value);
			}
		}
	}

	for (const [envName, envValue] of Object.entries(process.env)) {
		if (envValue === undefined || envValue === null) continue;

		// Check prefix allowlist
		const firstSegment = envName.split("_")[0];
		if (!prefixSet.has(firstSegment)) continue;

		// Look up the env var in the reverse map
		let dotPath = reverseMap.get(envName);

		// Fallback: check record patterns for dynamic key matching
		if (!dotPath) {
			for (const pattern of recordPatterns) {
				if (envName.startsWith(pattern.envPrefix + "_")) {
					// Extract the dynamic key and remaining sub-path
					const suffix = envName.slice(pattern.envPrefix.length + 1);
					const parts = suffix.split("_");

					// The first part is the dynamic record key
					const dynamicKey = parts[0].toLowerCase();
					const restParts = parts.slice(1);

					if (restParts.length === 0) {
						// Just the record key itself — shouldn't normally happen
						dotPath = pattern.dotPrefix + "." + dynamicKey;
					} else {
						// Try to match the remaining parts against sub-path templates
						const subEnvName = restParts.join("_");
						const templates = subPathTemplates.get(pattern.envPrefix);
						if (templates && templates.has(subEnvName)) {
							dotPath = pattern.dotPrefix + "." + dynamicKey + "." + templates.get(subEnvName);
						} else {
							// Fallback: lowercase all remaining segments
							dotPath =
								pattern.dotPrefix + "." + dynamicKey + "." + restParts.join(".").toLowerCase();
						}
					}
					break;
				}
			}
		}

		// Fallback: derive path heuristically
		if (!dotPath) {
			dotPath = _derivePathFromEnvName(envName, knownSections);
		}

		if (!dotPath) continue;

		// Parse the value
		const parsed = _parseValue(envValue);

		// Materialize the path — applyDotPath is idempotent and won't
		// override existing keys
		applyDotPath(raw, dotPath, parsed);
	}

	return raw;
}

/**
 * Derive a config dot-path from an env-var name using heuristics.
 * This is a fallback for env vars not found in the schema-driven reverse map
 * (e.g., passthrough schemas like `providers`).
 *
 * Strategy: Convert env-var segments to lowercase and join with dots.
 * The first segment should match a known section (already validated by prefix allowlist).
 *
 * For env vars whose first segment doesn't match a known section directly
 * (because DROPPED_KEYS were removed), try to find a matching section by
 * checking if the env-var name starts with any known section's UPPER_SNAKE form.
 *
 * @param {string} envName - Environment variable name (e.g., "OPENAI_API_KEY")
 * @param {string[]} knownSections - Top-level config section names
 * @returns {string|null} Dot-path or null if derivation failed
 */
function _derivePathFromEnvName(envName, knownSections) {
	const segments = envName.split("_").map((s) => s.toLowerCase());
	if (segments.length < 2) return null;

	const firstSeg = segments[0];

	// If the first segment is a known section, join with dots
	if (knownSections.includes(firstSeg)) {
		return segments.join(".");
	}

	// Try to find a known section that could produce this env var name.
	// Check if the env var starts with the section's UPPER_SNAKE form.
	for (const section of knownSections) {
		if (envName.startsWith(_toUpperSnake(section) + "_")) {
			return [section, ...segments.slice(1)].join(".");
		}
	}

	// Last resort: join all segments with dots
	return segments.join(".");
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
		"subAgentsTemperature", // e.g. subAgentsTemperature.coding → SUB_AGENTS_TEMPERATURE_CODING
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
	// before resolving env-var overrides. This runs between YAML deepMerge
	// and _resolveEnvRecursively so that env vars can define new config paths
	// that don't exist in config.yaml.
	syncEnv(raw, KNOWN_SECTIONS);
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
