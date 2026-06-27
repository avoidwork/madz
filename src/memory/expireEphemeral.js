import { readdir, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "./reader.js";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Read an ephemeral memory file and extract frontmatter metadata.
 * @param {string} contextDir - Directory containing the file
 * @param {string} filename - The filename
 * @returns {Promise<{ ephemeral: boolean, expiresAt: string } | null>} Parsed metadata or null if unreadable
 */
export async function readEphemeralFile(contextDir, filename) {
	try {
		const filepath = join(cwd, contextDir, filename);
		const content = await readFile(filepath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		return {
			ephemeral: frontmatter.ephemeral === true,
			expiresAt: frontmatter.ephemeral_expiresAt || "",
		};
	} catch {
		return null;
	}
}

/**
 * Check if an ephemeral memory entry has expired.
 * @param {string} expiresAt - The expiresAt ISO string
 * @param {Date} [now] - Current date (defaults to new Date())
 * @returns {boolean} Whether the memory is expired
 */
export function isExpired(expiresAt, now) {
	const checkNow = now || new Date();
	if (!expiresAt) return false;
	return new Date(expiresAt) < checkNow;
}

/**
 * Remove expired ephemeral memory files from the context directory.
 * Non-blocking: silently skips missing files and invalid entries.
 * @param {string} contextDir - Directory to scan and clean
 * @param {string} [nowStr] - Optional ISO timestamp for deterministic testing
 * @returns {Promise<number>} Number of files removed
 */
export async function expireEphemeralMemories(contextDir, nowStr) {
	const checkNow = nowStr ? new Date(nowStr) : new Date();
	let files;
	try {
		files = await readdir(join(cwd, contextDir));
	} catch {
		return 0;
	}
	let removed = 0;
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const info = await readEphemeralFile(contextDir, file);
		if (info && info.ephemeral && isExpired(info.expiresAt, checkNow)) {
			const filepath = join(cwd, contextDir, file);
			try {
				await unlink(filepath);
				removed++;
			} catch {
				// Ignore deletion errors
			}
		}
	}
	return removed;
}