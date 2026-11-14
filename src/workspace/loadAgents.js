import { open } from "node:fs/promises";
import { join } from "node:path";

const cwd = process.cwd();

/** Accepted AGENTS.md file names, in priority order. */
export const AGENTS_FILE_NAMES = ["AGENTS.md", "agents.md"];

/**
 * Read an AGENTS.md file in one pass: open, fstat for the size limit, then read
 * from the same handle, so there is no check/read race and no repeated existence checks.
 * A missing file is a successful "not found" result; other failures are errors.
 * @param {string} filePath - Path of the file to read
 * @param {number} [maxReadSize] - Maximum file size to read, in bytes
 * @returns {Promise<{ ok: true, found: boolean, content: string } | { ok: false, error: string }>}
 */
export async function readAgentsFile(filePath, maxReadSize) {
	let handle;
	try {
		handle = await open(filePath, "r");
	} catch (err) {
		if (err.code === "ENOENT" || err.code === "ENOTDIR") {
			return { ok: true, found: false, content: "" };
		}
		return { ok: false, error: `Cannot read ${filePath}: ${err.message}` };
	}
	try {
		const stats = await handle.stat();
		if (!stats.isFile()) {
			return { ok: false, error: `Not a regular file: ${filePath}` };
		}
		const limit = maxReadSize;
		if (limit && stats.size > limit) {
			return {
				ok: false,
				error: `File size (${stats.size} bytes) exceeds max read size (${limit}).`,
			};
		}
		const content = await handle.readFile("utf-8");
		return { ok: true, found: true, content };
	} catch (err) {
		return { ok: false, error: `Cannot read ${filePath}: ${err.message}` };
	} finally {
		await handle.close();
	}
}

/**
 * Load AGENTS.md from a directory and format it for the system prompt.
 * @param {string} [targetCwd] - Directory to read AGENTS.md from. Defaults to the process
 *   working directory captured at import.
 * @param {number} [maxReadSize] - Maximum file size to read, in bytes
 * @returns {Promise<string>} Formatted prompt section, or empty string if no file is found
 * @throws {Error} If the file exists but cannot be read or exceeds the size limit
 */
export async function loadAgents(targetCwd, maxReadSize) {
	const dir = targetCwd || cwd;
	for (const name of AGENTS_FILE_NAMES) {
		const result = await readAgentsFile(join(dir, name), maxReadSize);
		if (!result.ok) throw new Error(result.error);
		if (result.found) {
			return (
				"## Workspace Rules\n\n" +
				"The following rules are loaded from the workspace `AGENTS.md`. They define project-specific conventions and constraints. Follow them strictly:\n\n" +
				"---\n\n" +
				result.content.trim()
			);
		}
	}
	return "";
}
