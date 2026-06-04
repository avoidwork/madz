import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { writeMemoryFile } from "../memory/writer.js";

/**
 * Save session exchanges to a file named by thread ID.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {Array} conversation - Conversation exchanges to save
 * @param {string} [threadId] - Thread ID used as filename
 */
export function saveSession(sessionsDir, conversation, threadId = "") {
	const dir = join(process.cwd(), sessionsDir);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	const filename = threadId ? `${threadId}.md` : "unsaved.md";
	const isoTimestamp = new Date().toISOString();

	const body = JSON.stringify(conversation, null, 2);

	const metadata = {
		threadId: threadId || "unsaved",
		messageCount: Array.isArray(conversation) ? conversation.length : 0,
		startedAt: conversation[0]?.timestamp || isoTimestamp,
		endedAt: isoTimestamp,
	};

	writeMemoryFile(sessionsDir, filename, metadata, body);
}
