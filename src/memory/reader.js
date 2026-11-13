import { open } from "node:fs/promises";
import { load } from "js-yaml";
import { logger } from "../shared/logger.js";

/** Maximum memory file size that will be read (bytes). */
export const MAX_MEMORY_FILE_BYTES = 64 * 1024;

const FRONTMATTER_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n([\s\S]*))?$/;
const QUOTED_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\n]|'')*'/g;
const YAML_ANCHOR_ALIAS_RE = /(?:^|[\s:[,{-])[&*][^\s,\]}]+/m;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Normalise the `timestamp` field to a Date when it is a valid date value.
 * Done explicitly so behaviour does not depend on the js-yaml version.
 * @param {Object} frontmatter - Parsed frontmatter (mutated)
 * @returns {void}
 */
function normalizeTimestamp(frontmatter) {
	const ts = frontmatter.timestamp;
	if (typeof ts === "string" && ISO_DATE_RE.test(ts)) {
		const date = new Date(ts);
		if (!Number.isNaN(date.getTime())) frontmatter.timestamp = date;
	}
}

/**
 * Parse the YAML text of a frontmatter block, ignoring anchors/aliases.
 * @param {string} fmStr - Raw YAML text
 * @returns {Object} Plain-object frontmatter ({} on any problem)
 */
function parseYamlBlock(fmStr) {
	if (YAML_ANCHOR_ALIAS_RE.test(fmStr.replace(QUOTED_RE, '""'))) {
		logger.warn("[reader] Ignoring frontmatter containing YAML anchors or aliases");
		return {};
	}
	try {
		const parsed = load(fmStr);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch (err) {
		logger.warn(`[reader] YAML parse failed: ${err.message}`);
		return {};
	}
}

/**
 * Parse YAML frontmatter from a markdown file.
 * @param {string} content - The full markdown content
 * @returns {{ frontmatter: Object, content: string }} Parsed frontmatter and body
 */
export function parseFrontmatter(content) {
	if (!content) return { frontmatter: {}, content: "" };

	let frontmatter = {};
	let body = content;

	const match = content.match(FRONTMATTER_RE);
	if (match) {
		frontmatter = parseYamlBlock(match[1] || "");
		body = match[2] || "";
		normalizeTimestamp(frontmatter);
	}

	return { frontmatter, content: body.trim() };
}

/**
 * Load and parse a memory markdown file. Files larger than
 * {@link MAX_MEMORY_FILE_BYTES} are ignored.
 * @param {string} filepath - Full path to the markdown file
 * @returns {Promise<{ frontmatter: Object, content: string, path: string } | null>}
 *   The parsed file, or null when it is missing, not a regular file or too large
 * @throws {Error} For read errors other than ENOENT
 */
export async function readMemoryFile(filepath) {
	let handle;
	try {
		handle = await open(filepath, "r");
	} catch (err) {
		if (err.code === "ENOENT") {
			logger.debug(`[reader] File not found: ${filepath}`);
			return null;
		}
		throw err;
	}
	try {
		const st = await handle.stat();
		if (!st.isFile() || st.size > MAX_MEMORY_FILE_BYTES) {
			logger.warn(`[reader] Skipping ${filepath}: not a regular file or larger than 64 KB`);
			return null;
		}
		const raw = await handle.readFile("utf-8");
		const { frontmatter, content: body } = parseFrontmatter(raw);
		return { frontmatter, content: body, path: filepath };
	} finally {
		await handle.close();
	}
}
