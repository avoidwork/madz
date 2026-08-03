import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Load a session by ID or the latest session file.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {number} [windowSize=20] - Context window limit for loaded messages
 * @param {string} [sessionId] - Optional session/thread ID to load (fallbacks to latest)
 * @returns {Promise<{ sessionId: string, conversation: Array, metadata: Object }>}
 */
export async function loadSession(
	sessionsDir = "memory/sessions/",
	windowSize = 20,
	sessionId = "",
	cwdParam = cwd,
) {
	const dir = join(cwdParam, sessionsDir);

	if (sessionId) {
		const filepath = join(dir, `${sessionId}.md`);
		return loadFile(filepath, windowSize);
	}

	// Load latest file
	let latestFile = null;
	let latestTime = 0;
	try {
		const files = await readdir(dir);
		for (const file of files) {
			if (!file.endsWith(".md")) continue;
			const st = await stat(join(dir, file));
			if (st.mtimeMs > latestTime) {
				latestTime = st.mtimeMs;
				latestFile = file;
			}
		}
	} catch (_err) {
		// Directory doesn't exist — return empty
		return { sessionId: "", conversation: [], metadata: {} };
	}

	if (!latestFile) {
		return { sessionId: "", conversation: [], metadata: {} };
	}

	return loadFile(join(dir, latestFile), windowSize);
}

async function loadFile(filepath, windowSize) {
	const content = await readFile(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);

	let conversation = [];
	try {
		const parsed = JSON.parse(body);
		if (Array.isArray(parsed)) {
			conversation = parsed;
		}
	} catch (_err) {
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
