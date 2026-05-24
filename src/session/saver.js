import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { writeMemoryFile } from "../memory/writer.js";

/**
 * Save session exchanges to the latest conversation file.
 * @param {string} conversationsDir - Path to conversations directory
 * @param {Array} conversation - Conversation exchanges to save
 * @param {string} [sessionId] - Optional session ID to include in frontmatter
 */
export function saveSession(conversationsDir, conversation, sessionId = "") {
	const dir = join(process.cwd(), conversationsDir);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

	// Try to update latest conversation file
	let latestFile = null;
	let latestTime = 0;

	try {
		const files = readdirSync(dir);
		for (const file of files) {
			if (!file.endsWith(".md")) continue;
			const stat = statSync(join(dir, file));
			if (stat.mtimeMs > latestTime) {
				latestTime = stat.mtimeMs;
				latestFile = file;
			}
		}
	} catch {
		// Directory doesn't exist — create fresh file
	}

	const _filename = latestFile || `${sessionId || timestamp}-session.md`;

	// Convert conversation to JSON body
	const body = JSON.stringify(conversation, null, 2);

	const metadata = {
		sessionId,
		messageCount: Array.isArray(conversation) ? conversation.length : 0,
		startedAt: conversation[0]?.timestamp || timestamp,
		endedAt: timestamp,
	};

	writeMemoryFile(conversationsDir, `${sessionId || "session"} ${timestamp}`, metadata, body);
}
