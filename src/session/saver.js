import { rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";
import { sessionFilePath } from "./sessionId.js";

// cwd is pinned at init via setConfig(). Defaults to loadConfig().cwd (captured
// once at load) but is overridden during bootstrap() so it reflects the
// intended project root rather than whatever process.cwd() was at import time.
let cwd = loadConfig().cwd;

/**
 * Pin the saver's base directory. Called once during bootstrap().
 * @param {string} newCwd - Absolute path to the project root
 */
export function setConfig(newCwd) {
	if (typeof newCwd === "string" && newCwd.length > 0) {
		cwd = newCwd;
	}
}

/**
 * Escape a string for safe inclusion in a YAML double-quoted scalar.
 * Escapes backslashes and double quotes first (to avoid double-escaping),
 * then newlines, carriage returns, tabs and other control characters.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeYamlString(str) {
	return (
		str
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			// oxlint-disable-next-line no-control-regex -- intentionally matching C0 controls
			.replace(/[\u0000-\u001f\u007f]/g, (ch) => {
				if (ch === "\n") return "\\n";
				if (ch === "\r") return "\\r";
				if (ch === "\t") return "\\t";
				return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
			})
	);
}

/**
 * Save session exchanges to a file named by thread ID.
 * The write is atomic (temp file + rename).
 * @param {string} sessionsDir - Path to sessions directory
 * @param {Array} conversation - Conversation exchanges to save
 * @param {string} [threadId] - Thread ID used as filename (empty writes unsaved.md)
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 * @throws {Error} If the thread ID is invalid, or the underlying filesystem operation fails (missing directory, disk full, permissions)
 */
export async function saveSession(sessionsDir, conversation, threadId = "", cwdParam = cwd) {
	const dir = join(cwdParam, sessionsDir);

	const target = sessionFilePath(dir, threadId || "unsaved");
	const isoTimestamp = new Date().toISOString();

	const body = JSON.stringify(conversation, null, 2);
	const first = Array.isArray(conversation) ? conversation[0] : undefined;

	const metadata = {
		threadId: threadId || "unsaved",
		messageCount: Array.isArray(conversation) ? conversation.length : 0,
		startedAt: first?.timestamp || isoTimestamp,
		endedAt: isoTimestamp,
	};

	const frontmatterLines = [
		"---",
		...Object.entries(metadata).map(([k, v]) => {
			if (v == null) return `${k}:`;
			if (typeof v === "string") return `${k}: "${escapeYamlString(v)}"`;
			if (typeof v === "boolean") return `${k}: ${v}`;
			if (typeof v === "number") return `${k}: ${v}`;
			return `${k}: ${JSON.stringify(v)}`;
		}),
		"---",
		"",
	];

	const content = frontmatterLines.join("\n") + body + "\n";

	const tmp = join(dir, `.${randomUUID()}.tmp`);
	try {
		await writeFile(tmp, content);
		await rename(tmp, target);
	} catch (err) {
		await rm(tmp, { force: true }).catch((cleanupErr) => {
			logger.warn(`[session] Failed to remove temp file ${tmp}: ${cleanupErr.message}`);
		});
		throw err;
	}
}
