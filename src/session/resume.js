import { loadSession } from "./loader.js";
import { assertSessionId } from "./sessionId.js";

/**
 * Resume a stored session: load it and replace the state with a fresh session
 * carrying the same ID (so the checkpointer thread follows).
 * @param {import("./stateManager.js").SessionStateManager} sessionState - State to populate
 * @param {string} sessionsDir - Sessions directory (relative to cwd)
 * @param {string} sessionId - ID of the session to resume
 * @param {string} [cwd] - Base directory (defaults to project cwd)
 * @param {number} [windowSize=20] - Context window for the loaded messages
 * @returns {Promise<{ sessionId: string, conversation: Array, metadata: Object }>} The loaded session
 * @throws {Error} If the ID is invalid, the session does not exist or is unreadable
 */
export async function resumeSession(sessionState, sessionsDir, sessionId, cwd, windowSize = 20) {
	assertSessionId(sessionId);
	let loaded;
	try {
		loaded = await loadSession(sessionsDir, windowSize, sessionId, cwd);
	} catch (err) {
		if (err.code === "ENOENT") {
			throw new Error(`Session not found: ${sessionId}`, { cause: err });
		}
		throw err;
	}
	sessionState.createNewSession(sessionId);
	sessionState.loadConversation(loaded.conversation);
	return loaded;
}
