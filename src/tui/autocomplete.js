import fg from "fast-glob";

/**
 * Search for files matching a prefix pattern using fast-glob.
 * Excludes node_modules, .git, and other .gitignore patterns.
 * Limits results to the top 5 matches.
 * @param {string} prefix - The prefix to search for (e.g., "src" from "@src")
 * @returns {Promise<string[]>} Array of matching file paths, limited to 5
 */
export async function searchFiles(prefix) {
	if (!prefix || prefix.length === 0) {
		return [];
	}

	try {
		const matches = await fg(`**/${prefix}*`, {
			cwd: process.cwd(),
			ignore: ["node_modules/**", ".git/**", ".husky/**", "dist/**", "coverage.txt", "memory/**"],
			onlyFiles: true,
			absolute: false,
		});

		return matches.slice(0, 5);
	} catch (err) {
		// Silently return empty on search failure — don't crash the TUI
		return [];
	}
}
