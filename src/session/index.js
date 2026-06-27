import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Ensure the sessions directory exists by creating it if necessary.
 * @param {string} sessionsDir - Path to sessions directory
 * @returns {Promise<void>}
 */
export async function ensureSessionsDir(sessionsDir) {
	const dir = join(cwd, sessionsDir);
	await mkdir(dir, { recursive: true });
}

export { createSession } from "./factory.js";
export { SessionStateManager } from "./stateManager.js";
export { enforceContextWindow, trimConversation } from "./window.js";
export { loadSession } from "./loader.js";
export { saveSession } from "./saver.js";
export { handleShutdown, registerShutdownHandler } from "./shutdown.js";
export { createCheckpointer } from "./checkpointer.js";
