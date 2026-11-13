import { join, relative, isAbsolute } from "node:path";

const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Check whether a value is a safe session ID (usable as a file name).
 * @param {unknown} sessionId - Candidate session ID
 * @returns {boolean} True for 1-128 chars of A-Z, a-z, 0-9, "_" and "-"
 */
export function isValidSessionId(sessionId) {
	return typeof sessionId === "string" && SESSION_ID_RE.test(sessionId);
}

/**
 * Throw when a session ID is not safe to use as a file name.
 * @param {unknown} sessionId - Candidate session ID
 * @returns {string} The same ID, for chaining
 * @throws {Error} If the ID is invalid
 */
export function assertSessionId(sessionId) {
	if (!isValidSessionId(sessionId)) {
		throw new Error(
			`Invalid session ID ${JSON.stringify(String(sessionId)).slice(0, 80)}: ` +
				"expected 1-128 characters of letters, digits, '_' or '-'",
		);
	}
	return sessionId;
}

/**
 * Build the `<id>.md` path for a session inside a sessions directory.
 * Validates the ID and verifies the resolved path stays inside the directory.
 * @param {string} dir - Sessions directory
 * @param {string} sessionId - Session ID
 * @returns {string} Path of the session file
 * @throws {Error} If the ID is invalid or the path escapes `dir`
 */
export function sessionFilePath(dir, sessionId) {
	assertSessionId(sessionId);
	const filepath = join(dir, `${sessionId}.md`);
	const rel = relative(dir, filepath);
	if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(`Session path escapes the sessions directory: ${sessionId}`);
	}
	return filepath;
}
