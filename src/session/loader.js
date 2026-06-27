import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";

/**
 * Load a session by ID or the latest session file.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {number} [windowSize=20] - Context window limit for loaded messages
 * @param {string} [sessionId] - Optional session/thread ID to load (fallbacks to latest)
 * @returns {{ sessionId: string, conversation: Array, metadata: Object }}
 */
export function loadSession(sessionsDir = "memory/sessions/", windowSize = 20, sessionId = "") {
	const dir = join(cwd, sessionsDir);

	if (sessionId) {
		const filepath = join(dir, `${sessionId}.md`);
		return loadFile(filepath, windowSize);
	}

	// Load latest file
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

	return loadFile(join(dir, latestFile), windowSize);
}

function loadFile(filepath, windowSize) {
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);

	let conversation = [];
	try {
		const parsed = JSON.parse(body);
		if (Array.isArray(parsed)) {
			conversation = parsed;
		}
	} catch {
		conversation = [{ role: "system", content: body }];
	}

	const window = Math.max(1, Math.floor(windowSize));
	if (conversation.length > window) {
		conversation = conversation.slice(-window);
	}

	return {
		sessionId: frontmatter.threadId || frontmatter.sessionId || filepath.replace(/\.md$/, ""),
		conversation,
		metadata: frontmatter,
	};
}
sessionId || filepath.replace(/\.md$/, ""),
		conversation,
		metadata: frontmatter,
	};
}
