import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { logger } from "../logger.js";

const cwd = loadConfig().cwd;

/**
 * Remove memory files older than the retention policy allows.
 * @param {string} directory - The memory directory to clean
 * @param {number} retentionDays - Maximum age in days
 * @returns {Promise<number>} Number of files removed
 */
export async function cleanRetainedMemory(directory, retentionDays = 90, cwdParam = cwd) {
	const fullPath = join(cwdParam, directory);
	const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
	let removed = 0;

	try {
		const files = await readdir(fullPath);
		for (const filename of files) {
			if (!filename.endsWith(".md")) continue;
			const filepath = join(fullPath, filename);
			const st = await stat(filepath);
			if (st.mtimeMs < cutoff) {
				await unlink(filepath);
				removed++;
			}
		}
	} catch (err) {
		logger.debug(`[retention] Failed to read directory: ${err.message}`);
	}

	return removed;
}

/**
 * Enforce maximum entry count across a memory directory.
 * @param {string} directory - The memory directory to clean
 * @param {number} maxEntries - Maximum number of files to keep
 * @returns {Promise<number>} Number of files removed
 */
export async function enforceMaxEntries(directory, maxEntries = 1000, cwdParam = cwd) {
	const fullPath = join(cwdParam, directory);
	let removed = 0;

	try {
		const files = await readdir(fullPath);
		const entries = files
			.filter((f) => f.endsWith(".md"))
			.map(async (filename) => {
				const filepath = join(fullPath, filename);
				const st = await stat(filepath);
				return { filepath, mtime: st.mtimeMs };
			});
		const resolved = await Promise.all(entries);
		resolved.sort((a, b) => a.mtime - b.mtime);

		if (resolved.length > maxEntries) {
			const excess = resolved.length - maxEntries;
			for (let i = 0; i < excess; i++) {
				await unlink(resolved[i].filepath);
				removed++;
			}
		}
	} catch (err) {
		logger.debug(`[retention] Failed to read directory: ${err.message}`);
	}

	return removed;
}
