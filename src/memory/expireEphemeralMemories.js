import { readdir, unlink, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseFrontmatter } from "./reader.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

const cwd = loadConfig().cwd;

/**
 * Resolve the context directory to an absolute path, tolerating both
 * absolute and relative inputs. When `contextDir` is absolute it is used
 * as-is; when relative it is joined with `cwdParam`.
 * @param {string} contextDir - Directory to resolve
 * @param {string} [cwdParam] - Base directory for relative paths
 * @returns {string} The resolved absolute directory
 */
export function resolveContextDir(contextDir, cwdParam = cwd) {
	return isAbsolute(contextDir) ? contextDir : join(cwdParam, contextDir);
}

/**
 * Read an ephemeral memory file and extract frontmatter metadata.
 * @param {string} contextDir - Directory containing the file
 * @param {string} filename - The filename
 * @returns {Promise<{ ephemeral: boolean, expiresAt: string } | null>} Parsed metadata or null if unreadable
 */
export async function readEphemeralFile(contextDir, filename, cwdParam = cwd) {
	try {
		const filepath = join(resolveContextDir(contextDir, cwdParam), filename);
		const content = await readFile(filepath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		return {
			ephemeral: frontmatter.ephemeral === true,
			expiresAt: frontmatter.ephemeral_expiresAt || "",
		};
	} catch (err) {
		logger.debug(`[expireEphemeral] Failed to read ephemeral file: ${err.message}`);
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
export async function expireEphemeralMemories(contextDir, nowStr, cwdParam = cwd) {
	const checkNow = nowStr ? new Date(nowStr) : new Date();
	const resolvedDir = resolveContextDir(contextDir, cwdParam);
	let files;
	try {
		files = await readdir(resolvedDir);
	} catch (err) {
		logger.debug(`[expireEphemeralMemories] Failed to read directory: ${err.message}`);
		return 0;
	}
	let removed = 0;
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const info = await readEphemeralFile(resolvedDir, file);
		if (info && info.ephemeral && isExpired(info.expiresAt, checkNow)) {
			const filepath = join(resolvedDir, file);
			try {
				await unlink(filepath);
				removed++;
			} catch (unlinkErr) {
				logger.debug(`[expireEphemeral] Failed to delete file: ${unlinkErr.message}`);
			}
		}
	}
	return removed;
}
