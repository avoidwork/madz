import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Remove memory files older than the retention policy allows.
 * @param {string} directory - The memory directory to clean
 * @param {number} retentionDays - Maximum age in days
 * @returns {number} Number of files removed
 */
export function cleanRetainedMemory(directory, retentionDays = 90) {
	const fullPath = join(process.cwd(), directory);
	const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
	let removed = 0;

	try {
		const files = readdirSync(fullPath);
		for (const filename of files) {
			if (!filename.endsWith(".md")) continue;
			const filepath = join(fullPath, filename);
			const stat = statSync(filepath);
			if (stat.mtimeMs < cutoff) {
				unlinkSync(filepath);
				removed++;
			}
		}
	} catch {
		// Directory doesn't exist or can't be read — skip silently
	}

	return removed;
}

/**
 * Enforce maximum entry count across a memory directory.
 * @param {string} directory - The memory directory to clean
 * @param {number} maxEntries - Maximum number of files to keep
 * @returns {number} Number of files removed
 */
export function enforceMaxEntries(directory, maxEntries = 1000) {
	const fullPath = join(process.cwd(), directory);
	let removed = 0;

	try {
		const files = readdirSync(fullPath)
			.filter((f) => f.endsWith(".md"))
			.map((filename) => {
				const filepath = join(fullPath, filename);
				const mtime = statSync(filepath).mtimeMs;
				return { filepath, mtime };
			})
			.sort((a, b) => a.mtime - b.mtime);

		if (files.length > maxEntries) {
			const excess = files.length - maxEntries;
			for (let i = 0; i < excess; i++) {
				unlinkSync(files[i].filepath);
				removed++;
			}
		}
	} catch {
		// Directory doesn't exist — skip silently
	}

	return removed;
}
