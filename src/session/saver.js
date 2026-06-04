import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Save session exchanges to a file named by thread ID.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {Array} conversation - Conversation exchanges to save
 * @param {string} [threadId] - Thread ID used as filename
 * @throws {Error} If the underlying filesystem operation fails (missing directory, disk full, permissions)
 */
export async function saveSession(sessionsDir, conversation, threadId = "") {
	const dir = join(process.cwd(), sessionsDir);

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
			if (typeof v === "string") return `${k}: "${v}"`;
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
