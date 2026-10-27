import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { resolveFilePath, validatePath } from "../common.js";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

const VALID_ACTIONS = ["ls", "glob"];

/**
 * Execute ls action logic on raw input.
 * @param {object} input - { path }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Directory listing
 */
export async function lsImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	try {
		const entries = await readdir(resolved.path);
		return entries.join("\n");
	} catch (err) {
		return `Error: ${err.message}`;
	}
}

/**
 * Convert a glob pattern to a RegExp.
 * @param {string} pattern - Glob pattern (e.g. "**" + "/*.js")
 * @returns {RegExp} Compiled regex
 */
function globToRegex(pattern) {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, ".*")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, ".");
	return new RegExp(escaped);
}

/**
 * Execute glob action logic on raw input.
 * @param {object} input - { path, pattern }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Matching file paths
 */
export async function globImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	const pattern = input.pattern || "**/*";
	const regex = globToRegex(pattern);
	const results = [];
	const seen = new Set();
	const MAX_DEPTH = 50;

	async function walk(dir, depth = 0) {
		if (depth > MAX_DEPTH) return;
		try {
			const entries = await readdir(dir);
			for (const entry of entries) {
				const full = join(dir, entry);
				if (seen.has(full)) continue;
				seen.add(full);
				try {
					const statResult = await stat(full);
					if (statResult.isDirectory()) {
						await walk(full, depth + 1);
					} else if (statResult.isFile() && regex.test(full)) {
						results.push(full);
					}
				} catch {
					// Skip inaccessible entries
				}
			}
		} catch {
			// Skip inaccessible directories
		}
	}

	await walk(resolved.path);

	if (results.length === 0) {
		return "No files match the glob pattern.";
	}
	return results.join("\n");
}

/**
 * Core discovery logic implementing ls and glob actions.
 * @param {object} input - The tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<string>} Result string
 */
export async function discoveryImpl(input, options) {
	const { action } = input;

	switch (action) {
		case "ls":
			return lsImpl(input, options);
		case "glob":
			return globImpl(input, options);
		default:
			return `Error: Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`;
	}
}

/**
 * Discovery tool with ls and glob actions. Path listing only — no content
 * read or write. Every path is validated against the sandbox allowlist via
 * `validatePath`.
 */
export const discovery = tool(
	(input) =>
		discoveryImpl(input, {
			allowedPaths: config.sandbox?.paths || [],
		}),
	{
		name: "discovery",
		description:
			"Path discovery tool. Actions: ls (list directory entries), glob (match files by glob pattern). Path listing only — no content read or write. Every path is validated against the sandbox allowlist. Relative paths resolve against the active project cwd; omitting path defaults to the active project cwd (or config.cwd).",
		schema: z.object({
			action: z.enum(VALID_ACTIONS).describe("Action to perform: ls, glob"),
			path: z
				.string()
				.optional()
				.describe(
					"Path to the directory. Relative paths resolve against the active project cwd; omit to default to the active project cwd (or config.cwd).",
				),
			pattern: z.string().optional().describe("Glob pattern to match (glob action)"),
		}),
	},
);
