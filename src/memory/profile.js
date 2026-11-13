import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";
import { PROFILE_FILENAME, ensureDir } from "./paths.js";
import { writeFileAtomic } from "./fsUtil.js";

const MAX_VALUE_LENGTH = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Resolve the default profile path lazily from the current config.
 * @returns {string} Absolute path of profile.md
 */
function defaultProfilePath() {
	const config = loadConfig();
	return join(config.cwd, config.memory.contextDir, PROFILE_FILENAME);
}

/**
 * Profile attributes definition.
 * @type {Array<{key: string, prompt: string, order: number}>}
 */
export const ATTRIBUTES = Object.freeze([
	{ key: "name", prompt: "What is your name?", order: 0 },
	{ key: "dob", prompt: "When is your date of birth?", order: 1 },
	{ key: "relationship", prompt: "What is your relationship status?", order: 2 },
	{ key: "pets", prompt: "Tell me about your pets.", order: 3 },
	{ key: "hobbies", prompt: "What are your hobbies?", order: 4 },
	{ key: "expertise", prompt: "What are your domains of expertise?", order: 5 },
	{ key: "favorite bands", prompt: "What are your favorite bands?", order: 6 },
	{ key: "favorite books", prompt: "What are your favorite books?", order: 7 },
	{ key: "favorite tv", prompt: "What are your favorite TV shows?", order: 8 },
	{ key: "favorite movies", prompt: "What are your favorite movies?", order: 9 },
	{ key: "location", prompt: "What City & Country are you in?", order: 10 },
	{ key: "notes", prompt: "Is there anything else you'd like to share? (free-form)", order: 11 },
]);

const CONTROL_PATTERNS = Object.freeze({
	skip: /^(skip|skip onboarding)$/i,
	cancel: /^(cancel|stop)$/i,
	exit: /^exit$/i,
});

/**
 * Parse a profile body into a { key: value } object.
 * Each line is expected to be "key: value" format.
 * @param {string} body - Profile markdown body
 * @returns {Object} Parsed profile data
 */
function parseProfileBody(body) {
	if (!body) return {};
	const data = {};
	for (const line of body.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("--")) continue;
		const colonIndex = trimmed.indexOf(":");
		if (colonIndex > 0) {
			const key = trimmed.slice(0, colonIndex).trim();
			const value = trimmed.slice(colonIndex + 1).trim();
			if (key && value) {
				data[key] = value;
			}
		}
	}
	return data;
}

/**
 * Load the user's context profile from the markdown body.
 * @param {string} [profilePath] - Optional path override (default: configured context dir's profile.md)
 * @returns {Promise<{ data: Object, body: string } | null>} The parsed profile or null if absent/empty
 * @throws {Error} For read errors other than ENOENT (e.g. EACCES, EIO)
 */
export async function loadProfile(profilePath = defaultProfilePath()) {
	let content;
	try {
		content = await readFile(profilePath, "utf-8");
	} catch (err) {
		if (err.code === "ENOENT") return null;
		logger.error(`[profile] Failed to read profile ${profilePath}: ${err.message}`);
		throw err;
	}
	const body = content.trim();
	if (!body) return null;
	const data = parseProfileBody(body);
	const attrKeys = ATTRIBUTES.map((attr) => attr.key);
	const hasAttribute = attrKeys.some((k) => Object.prototype.hasOwnProperty.call(data, k));
	if (!hasAttribute) return null;
	return { data, body };
}

/**
 * Save the user's context profile atomically to the markdown body.
 * @param {Object} profileData - Profile object with attribute keys
 * @param {string} [profilePath] - Optional path override
 * @returns {Promise<void>}
 * @throws {RangeError} When a value contains control characters
 */
export async function saveProfile(profileData, profilePath = defaultProfilePath()) {
	const content = buildProfileContent(profileData);
	await ensureDir(dirname(profilePath), ".");
	await writeFileAtomic(profilePath, content);
}

/**
 * Check whether a context profile exists on disk.
 * @param {string} [profilePath] - Optional path override
 * @returns {Promise<boolean>}
 */
export async function hasProfile(profilePath = defaultProfilePath()) {
	try {
		await access(profilePath);
		return true;
	} catch (err) {
		if (err.code !== "ENOENT") {
			logger.warn(`[profile] Cannot check profile ${profilePath}: ${err.message}`);
		}
		return false;
	}
}

/**
 * Format the profile as a context block for LLM prompts.
 * Only includes non-empty attributes as `key: value` pairs.
 * @param {Object} profileData - Profile data from `loadProfile().data`
 * @returns {string} The formatted context block or empty string
 */
export function formatProfileContext(profileData) {
	if (!profileData || typeof profileData !== "object") return "";
	const pairs = [];
	for (const attr of ATTRIBUTES) {
		const val = profileData[attr.key];
		if (typeof val === "string" && val.trim() !== "") {
			pairs.push(`${attr.key}: ${val.trim()}`);
		}
	}
	if (pairs.length === 0) return "";
	return pairs.join(", ");
}

/**
 * Normalise a profile value for storage: line breaks collapse to a space,
 * whitespace is trimmed, length is capped and control characters are rejected.
 * @param {string} key - Attribute key (for error messages)
 * @param {string} value - Raw value
 * @returns {string} Single-line value
 * @throws {RangeError} When the value contains control characters
 */
function normalizeProfileValue(key, value) {
	const collapsed = value.replace(/\r?\n|\r/g, " ").trim();
	if (CONTROL_CHARS_RE.test(collapsed)) {
		throw new RangeError(`Profile value for "${key}" contains control characters`);
	}
	return collapsed.slice(0, MAX_VALUE_LENGTH);
}

/**
 * Build a markdown content string for a profile, storing data in the body.
 * @param {Object} profileData - Profile { key: value } pairs
 * @returns {string}
 */
function buildProfileContent(profileData) {
	const lines = [];
	for (const attr of ATTRIBUTES) {
		const val = profileData?.[attr.key];
		if (typeof val !== "string") continue;
		const clean = normalizeProfileValue(attr.key, val);
		if (clean) lines.push(`${attr.key}: ${clean}`);
	}
	return lines.join("\n") + "\n";
}

/**
 * Process user input against onboarding control patterns.
 * Returns control type or null if not a control.
 * @param {string} input - User input string
 * @returns {"skip" | "cancel" | "exit" | null}
 */
export function processOnboardingInput(input) {
	const trimmed = (input || "").trim();
	if (CONTROL_PATTERNS.exit.test(trimmed)) return "exit";
	if (CONTROL_PATTERNS.skip.test(trimmed)) return "skip";
	if (CONTROL_PATTERNS.cancel.test(trimmed)) return "cancel";
	return null;
}

/**
 * Get the attribute at a given index.
 * @param {number} index - 0-based attribute index
 * @returns {Object} { key, prompt, order }
 */
export function getAttribute(index) {
	return ATTRIBUTES[index];
}

/**
 * Filter profile data to only contain known attribute keys.
 * @param {Object} data - Raw profile data (null/undefined yield {})
 * @returns {Object} Sanitized profile data
 */
export function sanitizeProfileData(data) {
	const knownKeys = new Set(ATTRIBUTES.map((attr) => attr.key));
	const sanitized = {};
	for (const [key, value] of Object.entries(data ?? {})) {
		if (knownKeys.has(key)) {
			sanitized[key] = typeof value === "string" ? value : String(value ?? "");
		}
	}
	return sanitized;
}
