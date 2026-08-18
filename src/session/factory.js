import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

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
			threadId: sessionId,
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
