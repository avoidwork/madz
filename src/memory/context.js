import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../config/loader.js";
import { parseFrontmatter } from "./reader.js";
import { loadProfile, formatProfileContext } from "./profile.js";
import { isExpired } from "./expireEphemeralMemories.js";
import { logger } from "../shared/logger.js";

const execFileAsync = promisify(execFile);

const cwd = loadConfig().cwd;
const PROFILE_FILENAME = "profile.md";
const REFLECTION_FILENAME = "reflection.md";

/**
 * Read recent context files and return their content as a combined string,
 * including the context profile if present. The profile block is prepended
 * first, followed by user-provided context files sorted by timestamp,
 * then ephemeral memories (if any) sorted newest first.
 * @param {string} contextDir - Path to the context directory
 * @param {number} limit - Maximum number of recent context files to load (excludes profile and ephemeral)
 * @returns {Promise<string>} Combined context content with profile prefix
 */
export async function loadContext(contextDir = "memory/context/", limit = 10, cwdParam = cwd) {
	const fullPath = join(cwdParam, contextDir);
	try {
		// Load profile context block first
		const profileBlock = await loadAndFormatProfile(fullPath, contextDir);

		// Load all .md files (excluding profile.md and reflection.md)
		const allFiles = (await readdir(fullPath)).filter(
			(f) => f.endsWith(".md") && f !== PROFILE_FILENAME && f !== REFLECTION_FILENAME,
		);

		// Separate ephemeral and persistent files
		const persistentFiles = allFiles.filter((f) => !f.startsWith("ephemeral"));

		// Process persistent files sorted by timestamp (newest first)
		const persistentEntries = await Promise.all(
			persistentFiles.map(async (filename) => {
				const filepath = join(fullPath, filename);
				const content = await readFile(filepath, "utf-8");
				const { frontmatter, content: body } = parseFrontmatter(content);
				return {
					filepath,
					frontmatter,
					body,
					timestamp: frontmatter.timestamp || "",
				};
			}),
		);
		persistentEntries.sort((a, b) => {
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

		// Load the reflection file into its own section (if present)
		const reflectionBlock = await loadReflectionBlock(fullPath);

		// Load ephemeral memories last (newest first, limited)
		const ephemeralLimit = loadConfig().memory.ephemeralLimit;
		const ephemeralBlocks = await loadEphemeralBlocks(fullPath, ephemeralLimit);

		if (!profileBlock && !contextBlocks && !reflectionBlock && !ephemeralBlocks) return "";
		const sections = [];
		if (profileBlock) sections.push(`### PROFILE\n${profileBlock}`);
		if (contextBlocks) sections.push(`### MEMORIES\n${contextBlocks}`);
		if (reflectionBlock) sections.push(`### REFLECTION\n${reflectionBlock}`);
		if (ephemeralBlocks) sections.push(`### EPHEMERAL MEMORIES\n${ephemeralBlocks}`);
		return sections.join("\n\n");
	} catch (err) {
		logger.debug(`[context] Failed to load context: ${err.message}`);
		return "";
	}
}

/**
 * Load ephemeral memory blocks, reading only the newest `limit` non-expired
 * files. Uses `find` to list ephemeral files sorted by mtime (newest first),
 * mirroring the `reflectionSessions` pattern, then reads only what is needed.
 * @param {string} fullPath - Full path to the context directory
 * @param {number} limit - Maximum number of ephemeral files to load
 * @returns {Promise<string>} Combined ephemeral context blocks or empty string
 */
async function loadEphemeralBlocks(fullPath, limit) {
	let output;
	try {
		output = await execFileAsync("find", [
			fullPath,
			"-maxdepth",
			"1",
			"-type",
			"f",
			"-name",
			"ephemeral-*.md",
			"-printf",
			"%T@ %p\n",
		]);
	} catch {
		return "";
	}

	const lines = output.stdout
		.trim()
		.split("\n")
		.filter((l) => l.length > 0);
	if (lines.length === 0) return "";

	// Sort by mtime descending (newest first)
	lines.sort((a, b) => parseFloat(b.split(" ")[0]) - parseFloat(a.split(" ")[0]));

	const blocks = [];
	for (const line of lines) {
		if (blocks.length >= limit) break;
		// Format: "<mtime> <path>" — split on first space only
		const firstSpace = line.indexOf(" ");
		const filepath = firstSpace === -1 ? line : line.slice(firstSpace + 1);
		let content;
		try {
			content = await readFile(filepath, "utf-8");
		} catch {
			continue;
		}
		const { frontmatter, content: body } = parseFrontmatter(content);
		// Exclude expired ephemeral files
		if (isExpired(frontmatter.ephemeral_expiresAt || "")) continue;
		const title = frontmatter.title || filepath;
		blocks.push(`\n[Ephemeral: ${title}]\n${body.trim()}`);
	}

	return blocks.join("\n");
}

/**
 * Load the reflection summary file and return its narrative body.
 * The reflection file is written by the scheduled reflection skill and
 * contains a narrative summary of recent session history. It is rendered
 * as its own labeled section so the model knows what it is reading.
 * @param {string} fullPath - Full path to the context directory
 * @returns {Promise<string>} The reflection body or empty string
 */
async function loadReflectionBlock(fullPath) {
	try {
		const filepath = join(fullPath, REFLECTION_FILENAME);
		const content = await readFile(filepath, "utf-8");
		const { content: body } = parseFrontmatter(content);
		return body.trim();
	} catch (err) {
		logger.debug(`[context] Failed to load reflection: ${err.message}`);
		return "";
	}
}

/**
 * Load the context profile and format it for LLM prompts.
 * @param {string} fullPath - Full path to the context directory
 * @param {string} contextDir - Relative context directory path
 * @returns {Promise<string>} Formatted profile context block or empty string
 */
async function loadAndFormatProfile(fullPath, contextDir, cwdParam = cwd) {
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
