import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";

/**
 * List all thread IDs that have checkpoints in the SQLite database.
 * @param {import("@langchain/langgraph-checkpoint-sqlite").SqliteSaver} saver - SqliteSaver instance
 * @returns {Promise<string[]>} Array of unique thread IDs
 */
export async function listThreadIds(saver) {
	const threads = new Set();
	try {
		for await (const tuple of saver.list({})) {
			const tid = tuple?.config?.configurable?.thread_id;
			if (tid) {
				threads.add(tid);
			}
		}
	} catch {
		// DB may not exist yet or have no checkpoints — return empty
	}
	return [...threads];
}

/**
 * Load the latest conversation file from the sessions directory.
 * @param {string} conversationsDir - Path to conversations directory
 * @param {number} [windowSize=20] - Context window limit for loaded messages
 * @returns {{ sessionId: string, conversation: Array, metadata: Object }}
 */
export function loadSession(conversationsDir = "memory/conversations/", windowSize = 20) {
	const dir = join(process.cwd(), conversationsDir);
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
		// Directory doesn't exist — return empty
		return { sessionId: "", conversation: [], metadata: {} };
	}

	if (!latestFile) {
		return { sessionId: "", conversation: [], metadata: {} };
	}

	const filepath = join(dir, latestFile);
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);

	let conversation = [];
	try {
		const parsed = JSON.parse(body);
		if (Array.isArray(parsed)) {
			conversation = parsed;
		}
	} catch {
		// Body isn't JSON — treat as plain text single exchange
		conversation = [{ role: "system", content: body }];
	}

	// Apply window
	const window = Math.max(1, Math.floor(windowSize));
	if (conversation.length > window) {
		conversation = conversation.slice(-window);
	}

	return {
		sessionId: frontmatter.sessionId || latestFile.replace(/\.md$/, ""),
		conversation,
		metadata: frontmatter,
	};
}
