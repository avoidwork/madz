import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

// cwd is pinned at init via setConfig(). Defaults to loadConfig().cwd (captured
// once at load) but is overridden during bootstrap() so it reflects the
// intended project root rather than whatever process.cwd() was at import time.
let cwd = loadConfig().cwd;

/**
 * Pin the session factory's base directory. Called once during bootstrap().
 * @param {string} newCwd - Absolute path to the project root
 */
export function setConfig(newCwd) {
	if (typeof newCwd === "string" && newCwd.length > 0) {
		cwd = newCwd;
	}
}

/**
 * Generate a session UUID and create initial session state.
 * @param {Object} [config] - Optional session config override
 * @returns {{ sessionId: string, state: Object }}
 */
export function createSession(config = {}) {
	const sessionId = randomUUID();
	return {
		sessionId,
		state: {
			provider: config.provider || "openai",
			conversation: [],
			contextWindow: config.contextWindow || 20,
			skills: config.skills || [],
			sessionId,
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Ensure the sessions directory exists by creating it if necessary.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureSessionsDir(sessionsDir, cwdParam = cwd) {
	const dir = join(cwdParam, sessionsDir);
	await mkdir(dir, { recursive: true });
}
