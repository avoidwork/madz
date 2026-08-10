import { readFile, access, constants } from "node:fs/promises";
import { load } from "js-yaml";
import { logger } from "../shared/logger.js";

/**
 * Parse YAML frontmatter from a markdown file.
 * @param {string} content - The full markdown content
 * @returns {{ frontmatter: Object, content: string }} Parsed frontmatter and body
 */
export function parseFrontmatter(content) {
	if (!content) return { frontmatter: {}, content: "" };

	let frontmatter = {};
	let body = content;

	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (match) {
		const fmStr = match[1] || "";
		const fmParsed = (() => {
			try {
				return load(fmStr);
			} catch (err) {
				logger.debug(`[reader] YAML parse failed: ${err.message}`);
				return {};
			}
		})();
		frontmatter = fmParsed && typeof fmParsed === "object" ? fmParsed : {};
		body = match[2] || "";

		// js-yaml 5.x no longer auto-converts date strings to Date objects
		// Manually convert the 'timestamp' field back to a Date instance
		if (
			typeof frontmatter.timestamp === "string" &&
			/^\d{4}-\d{2}-\d{2}/.test(frontmatter.timestamp)
		) {
			const date = new Date(frontmatter.timestamp);
			if (!Number.isNaN(date.getTime())) {
				frontmatter.timestamp = date;
			}
		}
	}

	return { frontmatter, content: body.trim() };
}

/**
 * Load and parse a memory markdown file.
 * Returns { frontmatter, content, path }.
 * @param {string} filepath - Full path to the markdown file
 * @returns {Promise<{ frontmatter: Object, content: string, path: string } | null>}
 */
export async function readMemoryFile(filepath) {
	try {
		await access(filepath, constants.F_OK);
	} catch (err) {
		logger.debug(`[reader] File not found: ${err.message}`);
		return null;
	}
	const content = await readFile(filepath, "utf-8");
	const { frontmatter, content: body } = parseFrontmatter(content);
	return { frontmatter, content: body, path: filepath };
}
