import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

export let cwd = loadConfig().cwd;

/**
 * Escape a string for safe inclusion in a YAML double-quoted scalar.
 * Escapes backslashes, double quotes, and newlines in that order
 * to avoid double-escaping.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeYamlString(str) {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Save session exchanges to a file named by thread ID.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {Array} conversation - Conversation exchanges to save
 * @param {string} [threadId] - Thread ID used as filename
 * @throws {Error} If the underlying filesystem operation fails (missing directory, disk full, permissions)
 */
export async function saveSession(sessionsDir, conversation, threadId = "") {
	const dir = join(cwd, sessionsDir);

	const filename = threadId ? `${threadId}.md` : "unsaved.md";
	const isoTimestamp = new Date().toISOString();

	const body = JSON.stringify(conversation, null, 2);

	const metadata = {
		threadId: threadId || "unsaved",
		messageCount: Array.isArray(conversation) ? conversation.length : 0,
		startedAt: conversation[0]?.timestamp || isoTimestamp,
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
	await writeFile(join(dir, filename), content);
}
