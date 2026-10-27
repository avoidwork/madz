import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	access,
	readFile as readFileNode,
	writeFile as writeFileNode,
	mkdir,
	readdir,
	stat,
	unlink,
} from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import fg from "fast-glob";
import { validatePath, checkFileLimit } from "../common.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const config = loadConfig();

const execFileAsync = promisify(execFile);

const MAX_CONTENT_SIZE = 500 * 1024; // 500KB for write operations
const VALID_ACTIONS = ["read", "write", "edit", "delete", "ls", "glob", "grep"];

/** Directories excluded from the glob, matching the `@` file picker. */
const EXCLUDED_DIRS = ["**/node_modules/**", "**/.git/**"];

/**
 * Resolve the effective base directory for the file tool.
 * Prefers the active project cwd (set by the TUI when the user selects a
 * project), then falls back to `config.cwd`. This mirrors the `@` file picker,
 * which globs the active project directory.
 * @returns {string} The base directory for resolving relative paths
 */
export function resolveBaseDir() {
	return getProjectCwd() || config.cwd || process.cwd();
}

/**
 * Resolve the effective path for a file action.
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

// --- Helpers (restored from the removed src/tools/filesystem.js) ---

/**
 * Read a file and suggest similar filenames on file not found.
 * @param {string} filePath - The resolved file path
 * @returns {Promise<string|null>} Similar filename suggestion or null
 */
export async function suggestSimilarFile(filePath) {
	try {
		await access(filePath);
	} catch {
		const dir = dirname(filePath);
		const baseName = basename(filePath);
		const nameWithoutExt = baseName.replace(/\.[^.]+$/, "");

		try {
			const entries = await readdir(dir).catch(() => []);
			const suggestions = [];

			for (const entry of entries) {
				const entryWithoutExt = entry.replace(/\.[^.]+$/, "");
				const distance = levenshteinDistance(
					nameWithoutExt.toLowerCase(),
					entryWithoutExt.toLowerCase(),
				);
				if (distance <= 2 && distance > 0) {
					suggestions.push(entry);
				}
			}

			if (suggestions.length > 0) {
				return `Did you mean: ${suggestions.join(", ")}?`;
			}
		} catch {
			// directory inaccessible, skip suggestion
		}
	}
	return null;
}

/**
 * Calculate Levenshtein edit distance between two strings.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const matrix = [];
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1,
				);
			}
		}
	}
	return matrix[b.length][a.length];
}

/**
 * 9 fuzzy matching strategies for the edit action.
 * @param {string} target - Target string
 * @param {string} fileContent - File content to search within
 * @returns {Array<{ found: boolean, start?: number, end?: number, matched?: string }>}
 */
export function fuzzyMatch(target, fileContent) {
	const fileLines = fileContent.split("\n");

	// Strategy 1: Exact match
	const exactIdx = fileContent.indexOf(target);
	if (exactIdx !== -1) {
		return [{ found: true, start: exactIdx, end: exactIdx + target.length, matched: target }];
	}

	// Strategy 2: Line-by-line exact match
	const targetLines = target.split("\n");
	const matches = [];
	for (let i = 0; i <= fileLines.length - targetLines.length; i++) {
		const slice = fileLines.slice(i, i + targetLines.length).join("\n");
		if (slice === target) {
			const startOffset = fileLines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
			matches.push({
				found: true,
				start: startOffset,
				end: startOffset + target.length,
				matched: slice,
			});
		}
	}
	if (matches.length > 0) return matches;

	// Strategy 3: Trim trailing whitespace — skip if target has none
	if (target !== target.replace(/[ \t]+$/gm, "")) {
		const trimmedTarget = target.replace(/[ \t]+$/gm, "");
		const trimmedContent = fileContent.replace(/[ \t]+$/gm, "");
		const s3Idx = trimmedContent.indexOf(trimmedTarget);
		if (s3Idx !== -1)
			return [
				{ found: true, start: s3Idx, end: s3Idx + trimmedTarget.length, matched: trimmedTarget },
			];
	}

	// Strategy 4: Trim leading whitespace — skip if target has none
	if (target !== target.replace(/^[ \t]+/gm, "")) {
		const leadTrimmedTarget = target.replace(/^[ \t]+/gm, "");
		const leadTrimmedContent = fileContent.replace(/^[ \t]+/gm, "");
		const s4Idx = leadTrimmedContent.indexOf(leadTrimmedTarget);
		if (s4Idx !== -1)
			return [
				{
					found: true,
					start: s4Idx,
					end: s4Idx + leadTrimmedTarget.length,
					matched: leadTrimmedTarget,
				},
			];
	}

	// Strategy 5: Collapse whitespace
	const compactTarget = target.replace(/[ \t]+/g, " ");
	const compactContent = fileContent.replace(/[ \t]+/g, " ");
	const s5Idx = compactContent.indexOf(compactTarget);
	if (s5Idx !== -1)
		return [
			{ found: true, start: s5Idx, end: s5Idx + compactTarget.length, matched: compactTarget },
		];

	// Strategy 6: Case-insensitive
	const lowerTarget = target.toLowerCase();
	const lowerContent = fileContent.toLowerCase();
	const s6Idx = lowerContent.indexOf(lowerTarget);
	if (s6Idx !== -1)
		return [{ found: true, start: s6Idx, end: s6Idx + lowerTarget.length, matched: target }];

	// Strategy 7: Normalize newlines
	const normTarget = target.replace(/\r\n/g, "\n");
	const normContent = fileContent.replace(/\r\n/g, "\n");
	const s7Idx = normContent.indexOf(normTarget);
	if (s7Idx !== -1)
		return [{ found: true, start: s7Idx, end: s7Idx + normTarget.length, matched: normTarget }];

	// Strategy 8: Normalize tabs to spaces
	const tabTarget = target.replace(/\t/g, "    ");
	const tabContent = fileContent.replace(/\t/g, "    ");
	const s8Idx = tabContent.indexOf(tabTarget);
	if (s8Idx !== -1)
		return [{ found: true, start: s8Idx, end: s8Idx + tabTarget.length, matched: tabTarget }];

	// Strategy 9: Loose substring
	const looseTarget = target.replace(/\s+/g, " ").trim();
	const looseContent = fileContent.replace(/\s+/g, " ").trim();
	const s9Idx = looseContent.indexOf(looseTarget);
	if (s9Idx !== -1)
		return [{ found: true, start: s9Idx, end: s9Idx + looseTarget.length, matched: looseTarget }];

	return [{ found: false }];
}

/**
 * Generate a unified diff between old and new content.
 * @param {string} oldStr - Original string
 * @param {string} newStr - New string
 * @returns {string} Unified diff
 */
export function generateUnifiedDiff(oldStr, newStr) {
	const oldLines = oldStr.split("\n");
	const newLines = newStr.split("\n");
	const diff = ["--- a/file", "+++ b/file", ""];

	let oldIdx = 0,
		newIdx = 0;
	const hunks = [];
	let currentHunk = [];

	while (oldIdx < oldLines.length && newIdx < newLines.length) {
		if (oldLines[oldIdx] === newLines[newIdx]) {
			if (currentHunk.length > 0) {
				hunks.push([...currentHunk]);
				currentHunk = [];
			}
			oldIdx++;
			newIdx++;
		} else {
			currentHunk.push({ type: "-", line: oldLines[oldIdx] });
			currentHunk.push({ type: "+", line: newLines[newIdx] });
			oldIdx++;
			newIdx++;
		}
	}

	while (oldIdx < oldLines.length) {
		currentHunk.push({ type: "-", line: oldLines[oldIdx] });
		oldIdx++;
	}
	while (newIdx < newLines.length) {
		currentHunk.push({ type: "+", line: newLines[newIdx] });
		newIdx++;
	}

	if (currentHunk.length > 0) hunks.push(currentHunk);

	for (const hunk of hunks) {
		const context = hunk.filter((h) => h.type === "-").length;
		diff.push(
			`@@ -${Math.max(0, oldLines.length - context)},${context} +${Math.max(0, newLines.length - context)},${context} @@`,
		);
		for (const entry of hunk) {
			if (entry.type === "-") {
				diff.push(`-${entry.line}`);
			} else {
				diff.push(`+${entry.line}`);
			}
		}
		diff.push("");
	}

	return diff.join("\n");
}

/**
 * Native fs-based file search fallback.
 * @param {string} pattern - Search pattern
 * @param {string} resolvedPath - Resolved path to search
 * @param {number} maxResults - Max results
 * @returns {Promise<string>} Search results
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

	if (results.length === 0) {
		return "No matches found.";
	}
	return `Found ${results.length} matches:\n\n${results.join("\n")}`;
}

// --- Core logic functions (exported for testing) ---

/**
 * Execute read action logic on raw input.
 * @param {object} input - { path, offset?, limit? }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<string>} File content or error
 */
export async function readImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	const limitCheck = await checkFileLimit(resolved.path, options.maxReadSize);
	if (!limitCheck.ok) {
		return limitCheck.error;
	}

	let content;
	try {
		content = await readFileNode(resolved.path, "utf-8");
	} catch (err) {
		if (err.code === "ENOENT") {
			const suggestion = await suggestSimilarFile(resolved.path);
			const msg = suggestion ? `\n${suggestion}` : "";
			return `Error: File not found: ${resolved.path}${msg}`;
		}
		return `Error: ${err.message}`;
	}
	const lines = content.split("\n");

	if (input.offset !== undefined && input.limit !== undefined) {
		const sliced = lines.slice(input.offset, input.offset + input.limit);
		return sliced.map((line, i) => `${input.offset + i + 1}|${line}`).join("\n");
	}
	return lines.map((line, i) => `${i + 1}|${line}`).join("\n");
}

/**
 * Execute write action logic on raw input.
 * @param {object} input - { path, content }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Result message
 */
export async function writeImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	const byteSize = Buffer.byteLength(input.content, "utf-8");
	if (byteSize > MAX_CONTENT_SIZE) {
		return `Error: Content size (${byteSize} bytes) exceeds maximum allowed size (${MAX_CONTENT_SIZE} bytes).`;
	}

	const fileDir = dirname(resolved.path);
	try {
		await access(fileDir);
	} catch {
		await mkdir(fileDir, { recursive: true });
	}

	await writeFileNode(resolved.path, input.content, "utf-8");
	return `Successfully wrote ${input.content.length} bytes to ${input.path}`;
}

/**
 * Execute edit action logic on raw input.
 * @param {object} input - { path, oldString, newString }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<string>} Edit result
 */
export async function editImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	let content;
	try {
		content = await readFileNode(resolved.path, "utf-8");
	} catch (err) {
		return `Error: ${err.message}`;
	}

	const results = fuzzyMatch(input.oldString, content);

	if (!results.some((r) => r.found)) {
		const suggestions = [];
		const fileLines = content.split("\n");
		for (let i = 0; i < fileLines.length; i++) {
			const line = fileLines[i];
			const dist = levenshteinDistance(
				input.oldString.trim().toLowerCase(),
				line.trim().toLowerCase(),
			);
			if (dist > 0 && dist <= Math.floor(input.oldString.length / 2)) {
				suggestions.push(line.trim());
			}
		}
		const suggestionStr =
			suggestions.length > 0 ? `Suggestions: ${suggestions.slice(0, 5).join(", ")}` : "";
		return `Edit failed: Could not find matching text for oldString in the file.\n${suggestionStr}`;
	}

	const match = results.find((r) => r.found);
	content = content.slice(0, match.start) + input.newString + content.slice(match.end);
	await writeFileNode(resolved.path, content, "utf-8");

	const diff = generateUnifiedDiff(input.oldString, input.newString);
	return `Edit applied successfully.\nChanges: 1\n${diff}`;
}

/**
 * Execute delete action logic on raw input.
 * @param {object} input - { path }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Result message
 */
export async function deleteImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	try {
		await unlink(resolved.path);
		return `Successfully deleted ${resolved.path}`;
	} catch (err) {
		return `Error: ${err.message}`;
	}
}

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
 * Execute glob action logic on raw input.
 * @param {object} input - { path, glob }
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
	const results = await fg(pattern, {
		cwd: resolved.path,
		onlyFiles: true,
		ignore: EXCLUDED_DIRS,
		dot: false,
	});

	if (results.length === 0) {
		return "No files match the glob pattern.";
	}
	return results.join("\n");
}

/**
 * Execute grep action logic on raw input.
 * @param {object} input - { path, pattern, maxResults }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Matching lines
 */
export async function grepImpl(input, options) {
	const path = resolveFilePath(input.path);
	const resolved = validatePath(path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	try {
		const limit = input.maxResults || 20;
		const rgArgs = ["--line-number", "--no-heading", "-n", input.pattern, resolved.path].filter(
			Boolean,
		);
		const { stdout } = await execFileAsync("rg", rgArgs, { timeout: 10000, encoding: "utf-8" });
		const output = (stdout ?? "").trim();

		if (!output) {
			return "No matches found.";
		}

		const matches = output.split("\n").slice(0, limit);
		return `Found ${matches.length} matches:\n\n${matches.join("\n")}`;
	} catch (err) {
		if (err.code === "ENOENT" || err.code === 1 || err.status === 1) {
			return nativeSearch(input.pattern, resolved.path, input.maxResults || 20);
		}
		return `Error: ${err.message}`;
	}
}

/**
 * Core file logic implementing read, write, edit, delete, ls, glob,
 * and grep actions.
 * @param {object} input - The tool input
 * @param {object} options - Runtime options (allowedPaths, maxReadSize)
 * @returns {Promise<string>} Result string
 */
export async function fileImpl(input, options) {
	const { action } = input;

	switch (action) {
		case "read":
			return readImpl(input, options);
		case "write":
			return writeImpl(input, options);
		case "edit":
			return editImpl(input, options);
		case "delete":
			return deleteImpl(input, options);
		case "ls":
			return lsImpl(input, options);
		case "glob":
			return globImpl(input, options);
		case "grep":
			return grepImpl(input, options);
		default:
			return `Error: Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`;
	}
}

/**
 * File tool with read, write, edit, delete, search, ls, glob, and grep
 * actions. Uses the common `action` key pattern (like `todo` and `memory`).
 * Every path is validated against the sandbox allowlist via `validatePath`.
 */
export const file = tool(
	(input) =>
		fileImpl(input, {
			allowedPaths: config.sandbox?.paths || [],
			maxReadSize: config.sandbox?.maxReadSize || "1mb",
		}),
	{
		name: "file",
		description:
			"File system tool. Actions: read (file content with line numbers), write (create/overwrite a file), edit (apply a string replacement or unified diff), delete (remove a file), search (regex search via ripgrep with native fallback), ls (list directory entries), glob (match files by glob pattern), grep (search file contents). Every path is validated against the sandbox allowlist. Relative paths resolve against the active project cwd; omitting path defaults to the active project cwd (or config.cwd).",
		schema: z.object({
			action: z
				.enum(VALID_ACTIONS)
				.describe("Action to perform: read, write, edit, delete, search, ls, glob, grep"),
			path: z
				.string()
				.optional()
				.describe(
					"Path to the file or directory. Relative paths resolve against the active project cwd; omit to default to the active project cwd (or config.cwd).",
				),
			offset: z
				.number()
				.int()
				.min(0)
				.optional()
				.describe("Zero-based line offset to start from (read action)"),
			limit: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe("Maximum number of lines to read (read action)"),
			content: z.string().optional().describe("Content to write (write action)"),
			oldString: z.string().optional().describe("Text to find and replace (edit action)"),
			newString: z.string().optional().describe("Replacement text (edit action)"),
			pattern: z
				.string()
				.optional()
				.describe(
					"Regex pattern to search for (search/grep action), or glob pattern to match (glob action)",
				),
			maxResults: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Maximum number of results to return (search/grep action)"),
		}),
	},
);
