import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseFrontmatter } from "../memory/reader.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";
import { sessionFilePath } from "./sessionId.js";
import { normalizeWindowSize } from "./window.js";

const cwd = loadConfig().cwd;
const UNSAVED_FILE = "unsaved.md";

/**
 * Load a session by ID or the latest readable session file.
 * @param {string} sessionsDir - Path to sessions directory
 * @param {number} [windowSize=20] - Context window limit for loaded messages
 * @param {string} [sessionId] - Optional session/thread ID to load (fallbacks to latest)
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<{ sessionId: string, conversation: Array, metadata: Object }>}
 * @throws {Error} For an invalid ID, a missing (ENOENT) or corrupt explicit session, or a directory read error other than ENOENT
 */
export async function loadSession(
	sessionsDir = "memory/sessions/",
	windowSize = 20,
	sessionId = "",
	cwdParam = cwd,
) {
	const dir = join(cwdParam, sessionsDir);

	if (sessionId) {
		return loadFile(sessionFilePath(dir, sessionId), windowSize);
	}

	// Load latest readable file (newest first), skipping the unsaved placeholder
	let files;
	try {
		files = await readdir(dir);
	} catch (err) {
		if (err.code === "ENOENT") {
			return { sessionId: "", conversation: [], metadata: {} };
		}
		logger.error(`[session] Cannot read sessions directory ${dir}: ${err.message}`);
		throw err;
	}

	const candidates = [];
	for (const file of files) {
		if (!file.endsWith(".md") || file === UNSAVED_FILE) continue;
		const st = await stat(join(dir, file));
		candidates.push({ file, mtimeMs: st.mtimeMs });
	}
	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

	for (const { file } of candidates) {
		try {
			return await loadFile(join(dir, file), windowSize);
		} catch (err) {
			logger.warn(`[session] Skipping unreadable session ${file}: ${err.message}`);
		}
	}

	return { sessionId: "", conversation: [], metadata: {} };
}

/**
 * Read and parse one session file.
 * Keeps only message objects with a string `role`, applies the context window
 * and drops leading tool results so the window never starts mid tool-call pair.
 * @param {string} filepath - Absolute path of the session file
 * @param {number} windowSize - Context window limit
 * @returns {Promise<{ sessionId: string, conversation: Array, metadata: Object }>}
 * @throws {Error} If the file cannot be read or its body is not a JSON array
 */
async function loadFile(filepath, windowSize) {
	const content = await readFile(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);

	let parsed;
	try {
		parsed = JSON.parse(body);
	} catch (err) {
		logger.warn(`[session] Invalid JSON body in ${filepath}: ${err.message}`);
		throw new Error(`Session file is corrupt (invalid JSON): ${basename(filepath)}`, {
			cause: err,
		});
	}
	if (!Array.isArray(parsed)) {
		logger.warn(`[session] Body of ${filepath} is not a JSON array`);
		throw new Error(`Session file is corrupt (not an array): ${basename(filepath)}`);
	}

	let conversation = parsed.filter((m) => m && typeof m === "object" && typeof m.role === "string");
	if (conversation.length < parsed.length) {
		logger.warn(
			`[session] Dropped ${parsed.length - conversation.length} invalid message(s) from ${filepath}`,
		);
	}

	conversation = conversation.slice(-normalizeWindowSize(windowSize));
	const firstNonTool = conversation.findIndex((m) => m.role !== "tool");
	conversation = firstNonTool === -1 ? [] : conversation.slice(firstNonTool);

	return {
		sessionId: frontmatter.threadId || frontmatter.sessionId || basename(filepath, ".md"),
		conversation,
		metadata: frontmatter,
	};
}
