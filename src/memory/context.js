import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { parseFrontmatter } from "./reader.js";
import { loadProfile, formatProfileContext } from "./profile.js";

const cwd = loadConfig().cwd;
const PROFILE_FILENAME = "profile.md";

/**
 * Read recent context files and return their content as a combined string,
 * including the context profile if present. The profile block is prepended
 * first, followed by user-provided context files sorted by timestamp,
 * then ephemeral memories (if any) sorted newest first.
 * @param {string} contextDir - Path to the context directory
 * @param {number} limit - Maximum number of recent context files to load (excludes profile and ephemeral)
 * @returns {string} Combined context content with profile prefix
 */
export function loadContext(contextDir = "memory/context/", limit = 10) {
	const fullPath = join(cwd, contextDir);
	try {
		// Load profile context block first
		const profileBlock = loadAndFormatProfile(fullPath, contextDir);

		// Load all .md files (excluding profile.md)
		const allFiles = readdirSync(fullPath).filter((f) => f.endsWith(".md") && f !== PROFILE_FILENAME);

		// Separate ephemeral and persistent files
		const persistentFiles = allFiles.filter((f) => !f.startsWith("ephemeral"));
		const ephemeralFiles = allFiles.filter((f) => f.startsWith("ephemeral"));

		// Process persistent files sorted by timestamp (newest first)
		const persistentEntries = persistentFiles
			.map((filename) => {
				const filepath = join(fullPath, filename);
				const content = readFileSync(filepath, "utf-8");
				const { frontmatter, content: body } = parseFrontmatter(content);
				return {
					filepath,
					frontmatter,
					body,
					timestamp: frontmatter.timestamp || "",
				};
			})
			.sort((a, b) => {
				const aTs = a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp;
				const bTs = b.timestamp instanceof Date ? b.timestamp.toISOString() : b.timestamp;
				return (bTs || "").localeCompare(aTs || "");
			});

		const recent = persistentEntries.slice(0, limit);
		const contextBlocks = recent
			.map((entry) => {
				const title = entry.frontmatter.title || entry.filepath;
				return `\n[Context: ${title}]\n${entry.body.trim()}`;
			})
			.join("\n");

		// Load ephemeral memories last (newest first, limited)
		const ephemeralLimit = loadConfig().memory.ephemeralLimit;
		const ephemeralEntries = ephemeralFiles
			.map((filename) => {
				const filepath = join(fullPath, filename);
				const content = readFileSync(filepath, "utf-8");
				const { frontmatter, content: body } = parseFrontmatter(content);
				return {
					filepath,
					frontmatter,
					body,
					timestamp: frontmatter.timestamp || "",
				};
			})
			.sort((a, b) => {
				const aTs = a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp;
				const bTs = b.timestamp instanceof Date ? b.timestamp.toISOString() : b.timestamp;
				return (bTs || "").localeCompare(aTs || "");
			});

		const recentEphemeral = ephemeralEntries.slice(0, ephemeralLimit);
		const ephemeralBlocks = recentEphemeral
			.map((entry) => {
				const title = entry.frontmatter.title || entry.filepath;
				return `\n[Ephemeral: ${title}]\n${entry.body.trim()}`;
			})
			.join("\n");

		if (!profileBlock && !contextBlocks && !ephemeralBlocks) return "";
		const result =
			(profileBlock ? profileBlock + "\n" : "") + contextBlocks + ephemeralBlocks;
		return result;
	} catch {
		return "";
	}
}

/**
 * Load the context profile and format it for LLM prompts.
 * @param {string} fullPath - Full path to the context directory
 * @param {string} contextDir - Relative context directory path
 * @returns {string} Formatted profile context block or empty string
 */
function loadAndFormatProfile(fullPath, _contextDir) {
	try {
		const profilePath = join(fullPath, "..", "..", "memory", "context", "profile.md");
		const profile = loadProfile(profilePath);
		if (!profile) return "";
		return formatProfileContext(profile.data);
	} catch {
		return "";
	}
}