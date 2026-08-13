/**
 * Filesystem scanner for TUI file path autocomplete.
 * Recursively scans the project root, respects .gitignore,
 * applies extension whitelist and directory blacklist, and
 * returns relative paths sorted by relevance.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Parse a .gitignore file into an array of pattern strings.
 * Handles comments, blank lines, negation (!), and directory-only patterns (trailing /).
 * @param {string} gitignorePath - Absolute path to the .gitignore file
 * @returns {string[]} Array of gitignore patterns
 */
export function parseGitignore(gitignorePath) {
	try {
		const content = readFileSync(gitignorePath, "utf-8");
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"));
	} catch {
		return [];
	}
}

/**
 * Check if a path matches a gitignore pattern.
 * @param {string} relativePath - Path relative to project root
 * @param {string[]} patterns - Array of gitignore patterns
 * @returns {boolean} True if the path should be ignored
 */
export function matchesGitignore(relativePath, patterns) {
	for (const pattern of patterns) {
		const isNegation = pattern.startsWith("!");
		const cleanPattern = isNegation ? pattern.slice(1) : pattern;

		// Directory-only patterns: match if path starts with the pattern
		if (cleanPattern.endsWith("/")) {
			const dirPattern = cleanPattern.slice(0, -1);
			if (relativePath.startsWith(dirPattern + "/") || relativePath === dirPattern) {
				return !isNegation;
			}
		}

		// Simple glob: convert gitignore pattern to a check
		// Patterns without / are matched against basename
		if (!cleanPattern.includes("/")) {
			const basename = relativePath.split("/").pop() || relativePath;
			if (globMatch(basename, cleanPattern)) {
				return !isNegation;
			}
		} else {
			// Path-relative pattern
			if (globMatch(relativePath, cleanPattern)) {
				return !isNegation;
			}
		}
	}
	return false;
}

/**
 * Simple glob matching for .gitignore patterns.
 * Supports *, **, and ? wildcards.
 * @param {string} str - String to match
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
function globMatch(str, pattern) {
	// Escape regex special chars except * and ?
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, "[^/]");
	const regex = new RegExp(`^${escaped}$`);
	return regex.test(str);
}

/**
 * Recursively scan a directory for files.
 * @param {string} dir - Directory to scan
 * @param {string[]} blacklist - Directories to exclude
 * @returns {string[]} Array of relative file paths
 */
function scanDirectory(dir, blacklist) {
	const files = [];
	try {
		const entries = readFileSync(dir, { encoding: "utf-8", withFileTypes: true });
		for (const entry of entries) {
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				if (blacklist.includes(entry.name)) continue;
				const subDir = join(dir, entry.name);
				files.push(...scanDirectory(subDir, blacklist));
			} else if (entry.isFile()) {
				files.push(join(dir, entry.name));
			}
		}
	} catch {
		// Directory may not be readable — skip silently
	}
	return files;
}

/**
 * Scan the project root directory for files suitable for autocomplete.
 * Respects .gitignore, applies extension whitelist and directory blacklist,
 * and caps the result at maxEntries.
 * @param {Object} options
 * @param {string} options.projectRoot - Absolute path to the project root
 * @param {string[]} [options.extensions] - Allowed file extensions (without dot)
 * @param {string[]} [options.blacklist] - Directories to exclude
 * @param {number} [options.maxEntries] - Maximum number of files to return
 * @returns {string[]} Array of relative file paths
 */
export function scanProjectRoot({
	projectRoot,
	extensions = ["js", "ts", "json", "yaml", "yml", "md", "txt", "css", "html", "mjs", "cjs"],
	blacklist = ["node_modules", ".git", "dist", "build"],
	maxEntries = 5000,
} = {}) {
	const gitignorePath = join(projectRoot, ".gitignore");
	const gitignorePatterns = parseGitignore(gitignorePath);

	const rawFiles = scanDirectory(projectRoot, blacklist);

	// Filter by extension whitelist
	const filtered = rawFiles.filter((filePath) => {
		const ext = filePath.split(".").pop();
		if (!extensions.includes(ext)) return false;
		const relPath = relative(projectRoot, filePath);
		if (matchesGitignore(relPath, gitignorePatterns)) return false;
		return true;
	});

	// Cap at maxEntries
	const capped = filtered.slice(0, maxEntries);

	// Sort alphabetically for consistent ordering
	return capped.sort();
}
