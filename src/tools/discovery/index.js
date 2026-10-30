import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, stat, readFile as readFileNode } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import fg from "fast-glob";
import { validatePath } from "../common.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const config = loadConfig();

const execFileAsync = promisify(execFile);

const VALID_ACTIONS = ["ls", "glob", "grep"];

/** Directories excluded from the glob, matching the `@` file picker. */
const EXCLUDED_DIRS = ["**/node_modules/**", "**/.git/**"];

/**
 * Resolve the effective base directory for the discovery tool.
 * Prefers the active project cwd (set by the TUI when the user selects a
 * project), then falls back to `config.cwd`. This mirrors the `@` file picker,
 * which globs the active project directory.
 * @returns {string} The base directory for resolving relative paths
 */
export function resolveBaseDir() {
	return getProjectCwd() || config.cwd || process.cwd();
}

/**
 * Resolve the effective path for a discovery action.
 * When `path` is omitted, defaults to the base directory. When `path` is
 * relative, resolves it against the base directory so the tool operates within
 * the active project rather than the process cwd.
 * @param {string} [path] - The requested path (may be relative or omitted)
 * @returns {string} The resolved absolute path
 */
export function resolveFilePath(path) {
	if (!path) return resolveBaseDir();
	if (resolve(path) === path) return path; // already absolute
	return resolve(resolveBaseDir(), path);
}

/**
 * Native fs-based file search fallback.
 * @param {string} pattern - Search pattern
 * @param {string} resolvedPath - Resolved path to search
 * @param {number} maxResults - Max results
 * @returns {Promise<{ok: boolean, matches: string[], count: number}>} Search results
 */
export async function nativeSearch(pattern, resolvedPath, maxResults) {
	const results = [];
	const regex = new RegExp(pattern);
	const seen = new Set();
	const MAX_DEPTH = 50;

	function isBinary(buffer) {
		for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
			if (buffer[i] === 0) return true;
		}
		return false;
	}

	async function walk(dir, depth = 0) {
		if (depth > MAX_DEPTH) return;
		try {
			const entries = await readdir(dir);
			for (const entry of entries) {
				const full = join(dir, entry);
				// Prevent symlink loops
				if (seen.has(full)) continue;
				seen.add(full);
				try {
					const statResult = await stat(full);
					if (statResult.isDirectory()) {
						await walk(full, depth + 1);
					} else if (statResult.isFile()) {
						const buffer = await readFileNode(full);
						if (isBinary(buffer)) continue;
						const content = buffer.toString("utf-8");
						const lines = content.split("\n");
						for (let i = 0; i < lines.length && results.length < maxResults; i++) {
							if (regex.test(lines[i])) {
								results.push(`${full}:${i + 1}: ${lines[i].trim()}`);
							}
						}
					}
				} catch {
					// Skip inaccessible entries
				}
			}
		} catch {
			// Skip inaccessible directories
		}
	}

	await walk(resolvedPath);

	return { ok: true, matches: results, count: results.length };
}

/**
 * Execute ls action logic on raw input.
 * @param {object} input - { path }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, entries?: string[], error?: string}>} Directory listing
 */
export async function lsImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return { ok: false, error: resolved.error };
	}

	try {
		const entries = await readdir(resolved.path);
		return { ok: true, entries };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Execute glob action logic on raw input.
 * @param {object} input - { path, pattern }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, matches?: string[], error?: string}>} Matching file paths
 */
export async function globImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return { ok: false, error: resolved.error };
	}

	const pattern = input.pattern || "**/*";
	const results = await fg(pattern, {
		cwd: resolved.path,
		onlyFiles: true,
		ignore: EXCLUDED_DIRS,
		dot: false,
	});

	return { ok: true, matches: results };
}

/**
 * Execute grep action logic on raw input.
 * @param {object} input - { path, pattern, maxResults }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, matches?: string[], count?: number, error?: string}>} Matching lines
 */
export async function grepImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return { ok: false, error: resolved.error };
	}

	try {
		const limit = input.maxResults || 20;
		const rgArgs = ["--line-number", "--no-heading", "-n", input.pattern, resolved.path].filter(
			Boolean,
		);
		const { stdout } = await execFileAsync("rg", rgArgs, { timeout: 10000, encoding: "utf-8" });
		const output = (stdout ?? "").trim();

		if (!output) {
			return { ok: true, matches: [], count: 0 };
		}

		const matches = output.split("\n").slice(0, limit);
		return { ok: true, matches, count: matches.length };
	} catch (err) {
		if (err.code === "ENOENT" || err.code === 1 || err.status === 1) {
			return nativeSearch(input.pattern, resolved.path, input.maxResults || 20);
		}
		return { ok: false, error: err.message };
	}
}

/**
 * Core discovery logic implementing ls, glob, and grep actions.
 * @param {object} input - The tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<{ok: boolean, entries?: string[], matches?: string[], count?: number, error?: string}>} Result
 */
export async function discoveryImpl(input, options) {
	const { action } = input;

	switch (action) {
		case "ls":
			return lsImpl(input, options);
		case "glob":
			return globImpl(input, options);
		case "grep":
			return grepImpl(input, options);
		default:
			return {
				ok: false,
				error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
			};
	}
}

/**
 * Discovery tool with ls, glob, and grep actions. Uses the common `action`
 * key pattern (like `todo` and `memory`). Every path is validated against the
 * sandbox allowlist via `validatePath`. Requires only `filesystem:read`.
 */
export const discovery = tool(
	(input) =>
		discoveryImpl(input, {
			allowedPaths: config.sandbox?.paths || [],
		}),
	{
		name: "discovery",
		description:
			"Filesystem discovery tool. Actions: ls (list directory entries), glob (match files by glob pattern), grep (search file contents via ripgrep with native fallback). Every path is validated against the sandbox allowlist. Relative paths resolve against the active project cwd; omitting path defaults to the active project cwd (or config.cwd). Read-only: requires only filesystem:read.",
		schema: z.object({
			action: z.enum(VALID_ACTIONS).describe("Action to perform: ls, glob, grep"),
			path: z
				.string()
				.optional()
				.describe(
					"Path to the file or directory. Relative paths resolve against the active project cwd; omit to default to the active project cwd (or config.cwd).",
				),
			pattern: z
				.string()
				.optional()
				.describe(
					"Regex pattern to search for (grep action), or glob pattern to match (glob action)",
				),
			maxResults: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Maximum number of results to return (grep action)"),
		}),
	},
);
