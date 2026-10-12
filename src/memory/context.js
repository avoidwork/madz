import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { parseFrontmatter } from "./reader.js";
import { loadProfile, formatProfileContext } from "./profile.js";
import { logger } from "../shared/logger.js";

const PROFILE_FILENAME = "profile.md";

/**
 * Read recent context files and return their content as a combined string,
 * including the context profile if present. The profile block is prepended
 * first, followed by user-provided context files sorted by mtime (newest first),
 * then ephemeral memories (if any) sorted newest first.
 * @param {string} contextDir - Path to the context directory
 * @param {number} limit - Maximum number of recent context files to load (excludes profile and ephemeral)
 * @param {string} [cwdParam] - Base directory (defaults to config.cwd)
 * @returns {Promise<string>} Combined context content with profile prefix
 */
export async function loadContext(
	contextDir = loadConfig().memory.contextDir,
	limit = 10,
	cwdParam = loadConfig().cwd,
) {
	const fullPath = join(cwdParam, contextDir);
	try {
		// Load profile context block first
		const profileBlock = await loadAndFormatProfile(fullPath, contextDir, cwdParam);

		// Load all .md files (excluding profile.md)
		const allFiles = (await readdir(fullPath)).filter(
			(f) => f.endsWith(".md") && f !== PROFILE_FILENAME,
		);

		// Separate ephemeral and persistent files
		const persistentFiles = allFiles.filter((f) => !f.startsWith("ephemeral"));
		const ephemeralFiles = allFiles.filter((f) => f.startsWith("ephemeral"));

		// Process persistent files sorted by mtime (newest first), reading only the selected files
		const persistentEntries = await selectRecentFiles(fullPath, persistentFiles, limit);
		const contextBlocks = persistentEntries
			.map((entry) => {
				const title = entry.frontmatter.title || entry.filepath;
				return `\n[Context: ${title}]\n${entry.body.trim()}`;
			})
			.join("\n");

		// Load ephemeral memories last (newest first, limited)
		const ephemeralLimit = loadConfig().memory.ephemeralLimit;
		const ephemeralEntries = await selectRecentFiles(fullPath, ephemeralFiles, ephemeralLimit);
		const ephemeralBlocks = ephemeralEntries
			.map((entry) => {
				const title = entry.frontmatter.title || entry.filepath;
				return `\n[Ephemeral: ${title}]\n${entry.body.trim()}`;
			})
			.join("\n");

		if (!profileBlock && !contextBlocks && !ephemeralBlocks) return "";
		const result = (profileBlock ? profileBlock + "\n" : "") + contextBlocks + ephemeralBlocks;
		return result;
	} catch (err) {
		logger.debug(`[context] Failed to load context: ${err.message}`);
		return "";
	}
}

/**
 * Select the most recent files by mtime, then read content only for the selected files.
 * @param {string} fullPath - Full path to the context directory
 * @param {string[]} filenames - Candidate filenames
 * @param {number} limit - Maximum number of files to select
 * @returns {Promise<Array<{filepath: string, frontmatter: Object, body: string}>>} Selected entries
 */
async function selectRecentFiles(fullPath, filenames, limit) {
	// Stat each file to get mtime, sort newest first, slice to limit
	const entries = await Promise.all(
		filenames.map(async (filename) => {
			const filepath = join(fullPath, filename);
			try {
				const st = await stat(filepath);
				return { filepath, mtime: st.mtimeMs };
			} catch (err) {
				logger.debug(`[context] Failed to stat ${filename}: ${err.message}`);
				return null;
			}
		}),
	);

	const valid = entries.filter((e) => e !== null);
	valid.sort((a, b) => b.mtime - a.mtime);
	const selected = valid.slice(0, limit);

	// Read content only for the selected files
	return Promise.all(
		selected.map(async ({ filepath }) => {
			const content = await readFile(filepath, "utf-8");
			const { frontmatter, content: body } = parseFrontmatter(content);
			return { filepath, frontmatter, body };
		}),
	);
}

/**
 * Load the context profile and format it for LLM prompts.
 * @param {string} fullPath - Full path to the context directory
 * @param {string} contextDir - Relative context directory path
 * @param {string} [cwdParam] - Base directory (defaults to config.cwd)
 * @returns {Promise<string>} Formatted profile context block or empty string
 */
async function loadAndFormatProfile(fullPath, contextDir, cwdParam = loadConfig().cwd) {
	try {
		const profilePath = join(cwdParam, contextDir, PROFILE_FILENAME);
		const profile = await loadProfile(profilePath);
		if (!profile) return "";
		return formatProfileContext(profile.data);
	} catch (err) {
		logger.debug(`[context] Failed to load profile: ${err.message}`);
		return "";
	}
}
