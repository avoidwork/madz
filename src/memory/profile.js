import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const config = loadConfig();
const PROFILE_DIR = join(config.cwd, config.memory.contextDir);
const PROFILE_FILE = "profile.md";
const PROFILE_PATH = join(PROFILE_DIR, PROFILE_FILE);

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
 * @param {string} [profilePath] - Optional path override (default: memory/context/profile.md)
 * @returns {{ data: Object, body: string } | null} The parsed profile or null if not found
 */
export function loadProfile(profilePath = PROFILE_PATH) {
	if (!existsSync(profilePath)) return null;
	try {
		const content = readFileSync(profilePath, "utf-8");
		const body = content.trim();
		if (!body) return null;
		const data = parseProfileBody(body);
		const attrKeys = ATTRIBUTES.map((attr) => attr.key);
		const hasProfile = attrKeys.some((k) => Object.prototype.hasOwnProperty.call(data, k));
		if (!hasProfile) return null;
		return { data, body };
	} catch {
		return null;
	}
}

/**
 * Save the user's context profile atomically to the markdown body.
 * @param {Object} profileData - Profile object with attribute keys
 * @param {string} [profilePath] - Optional path override
 */
export function saveProfile(profileData, profilePath = PROFILE_PATH) {
	const profileDir = join(profilePath, "..");
	if (!existsSync(profileDir)) {
		mkdirSync(profileDir, { recursive: true });
	}
	const content = buildProfileContent(profileData);
	const tmpPath = profilePath + ".tmp";
	writeFileSync(tmpPath, content, "utf-8");
	renameSync(tmpPath, profilePath);
}

/**
 * Check whether a context profile exists on disk.
 * @param {string} [profilePath] - Optional path override
 * @returns {boolean}
 */
export function hasProfile(profilePath = PROFILE_PATH) {
	return existsSync(profilePath);
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
	return "[Context: Profile]\n" + pairs.join(", ");
}

/**
 * Build a markdown content string for a profile, storing data in the body.
 * @param {Object} profileData - Profile { key: value } pairs
 * @returns {string}
 */
function buildProfileContent(profileData) {
	const lines = [];
	for (const attr of ATTRIBUTES) {
		const val = profileData[attr.key];
		if (val != null && typeof val === "string" && val.trim()) {
			lines.push(attr.key + ": " + val.trim());
		}
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
 * @param {Object} data - Raw profile data
 * @returns {Object} Sanitized profile data
 */
export function sanitizeProfileData(data) {
	const knownKeys = new Set(ATTRIBUTES.map((attr) => attr.key));
	const sanitized = {};
	for (const [key, value] of Object.entries(data)) {
		if (knownKeys.has(key)) {
			sanitized[key] = typeof value === "string" ? value : String(value ?? "");
		}
	}
	return sanitized;
}
