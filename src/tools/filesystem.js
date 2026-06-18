import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { access, readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { validatePath, checkFileLimit } from "./common.js";

const MAX_CONTENT_SIZE = 500 * 1024; // 500KB for write operations

// --- Helpers ---

/**
 * Read a file and suggest similar filenames on file not found.
 * @param {string} filePath - The resolved file path
 * @param {string[]} _allowedPaths - Allowed sandbox directories
 * @returns {Promise<string|null>} Similar filename suggestion or null
 */
export async function suggestSimilarFile(filePath, _allowedPaths) {
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

// --- Core logic functions (exported for testing) ---

/**
 * Execute read_file logic on raw input.
 * @param {object} input - { path, offset?, limit? }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<string>} File content or error
 */
export async function readFileImpl(input, options) {
	const resolved = validatePath(input.path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	const limitCheck = await checkFileLimit(resolved.path, options.maxReadSize);
	if (!limitCheck.ok) {
		return limitCheck.error;
	}

	let content;
	try {
		content = await readFile(resolved.path, "utf-8");
	} catch (err) {
		if (err.code === "ENOENT") {
			const suggestion = await suggestSimilarFile(resolved.path, options.allowedPaths);
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
 * Execute write_file logic on raw input.
 * @param {object} input - { path, content }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Result message
 */
export async function writeFileImpl(input, options) {
	const resolved = validatePath(input.path, options.allowedPaths);
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

	await writeFile(resolved.path, input.content, "utf-8");
	return `Successfully wrote ${input.content.length} bytes to ${input.path}`;
}

/**
 * 9 fuzzy matching strategies for the patch tool.
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
 * Execute patch logic on raw input.
 * @param {object} input - { path, oldStr, newStr }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<string>} Patch result
 */
export async function patchImpl(input, options) {
	const resolved = validatePath(input.path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	let content = await readFile(resolved.path, "utf-8");
	const results = fuzzyMatch(input.oldStr, content);

	if (!results.some((r) => r.found)) {
		const suggestions = [];
		const fileLines = content.split("\n");
		for (let i = 0; i < fileLines.length; i++) {
			const line = fileLines[i];
			const dist = levenshteinDistance(
				input.oldStr.trim().toLowerCase(),
				line.trim().toLowerCase(),
			);
			if (dist > 0 && dist <= Math.floor(input.oldStr.length / 2)) {
				suggestions.push(line.trim());
			}
		}
		const suggestionStr =
			suggestions.length > 0 ? `Suggestions: ${suggestions.slice(0, 5).join(", ")}` : "";
		return `Patch failed: Could not find matching text for oldStr in the file.\n${suggestionStr}`;
	}

	const match = results.find((r) => r.found);
	content = content.slice(0, match.start) + input.newStr + content.slice(match.end);
	await writeFile(resolved.path, content, "utf-8");

	const diff = generateUnifiedDiff(input.oldStr, input.newStr);
	return `Patch applied successfully.\nChanges: 1\n${diff}`;
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
						const buffer = await readFile(full);
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

/**
 * Execute search_files logic on raw input.
 * @param {object} input - { path, pattern, target, maxResults }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<string>} Search results
 */
export async function searchFilesImpl(input, options) {
	const resolved = validatePath(input.path, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	try {
		const { execFile } = await import("node:child_process");
		const limit = input.maxResults || 20;
		const rgArgs = [
			"--line-number",
			"--no-heading",
			"-n",
			input.target === "filename" ? "--files-with-matches" : "",
			input.pattern,
			resolved.path,
		].filter(Boolean);
		const { stdout } = await execFile("rg", rgArgs, { timeout: 10000, encoding: "utf-8" });
		const output = stdout?.trim() ?? stdout;

		if (!output) {
			return "No matches found.";
		}

		const matches = output.split("\n").slice(0, limit);
		return `Found ${matches.length} matches:\n\n${matches.join("\n")}`;
	} catch (err) {
		if (err.code === "ENOENT" || err.status === 1) {
			return nativeSearch(input.pattern, resolved.path, input.maxResults || 20);
		}
		return `Error: ${err.message}`;
	}
}

// --- LangChain tool decorators ---

/**
 * @param {z.infer<typeof ReadFileSchema>} input
 * @param {object} options - Runtime options
 * @returns {Promise<string>}
 */
export const read_file = tool(readFileImpl, {
	name: "read_file",
	description:
		"Read the complete contents of a file from the file system. Supports pagination with offset/limit for large files. Returns lines in LINE_NUM|CONTENT format.",
	schema: z.object({
		path: z.string().describe("Path to the file to read"),
		offset: z.number().int().min(0).optional().describe("Zero-based line offset to start from"),
		limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
	}),
});

/**
 * @param {z.infer<typeof WriteFileSchema>} input
 * @param {object} options - Runtime options
 * @returns {Promise<string>}
 */
export const write_file = tool(writeFileImpl, {
	name: "write_file",
	description:
		"Write content to a file, creating all parent directories if they don't exist. Validates content size (max 500KB).",
	schema: z.object({
		path: z.string().describe("Path to the file to write"),
		content: z.string().describe("Content to write to the file"),
	}),
});

/**
 * @param {z.infer<typeof PatchSchema>} input
 * @param {object} options - Runtime options
 * @returns {Promise<string>}
 */
export const patch = tool(patchImpl, {
	name: "patch",
	description:
		"Apply a patch to a file using fuzzy pattern matching. Attempts up to 9 strategies (exact, whitespace trimming, case-insensitive, etc.) to find the oldStr. Returns a unified diff.",
	schema: z.object({
		path: z.string().describe("Path to the file to patch"),
		oldStr: z.string().describe("Text to find and replace"),
		newStr: z.string().describe("Replacement text"),
	}),
});

/**
 * @param {z.infer<typeof SearchFilesSchema>} input
 * @param {object} options - Runtime options
 * @returns {Promise<string>}
 */
export const search_files = tool(searchFilesImpl, {
	name: "search_files",
	description:
		"Search file contents using ripgrep (primary) or native fs fallback. Searches for a regex pattern in files within the given path. Can search by filename or content.",
	schema: z.object({
		path: z.string().describe("Path to directory or file to search within"),
		pattern: z.string().describe("Regex pattern to search for"),
		target: z
			.enum(["content", "filename", "both"])
			.default("content")
			.describe("What to search: file content, filenames, or both"),
		maxResults: z
			.number()
			.int()
			.positive()
			.default(20)
			.describe("Maximum number of results to return"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a read_file tool with runtime options
 * @param {object} options - Runtime options (allowedPaths, maxReadSize, etc.)
 * @returns {object} LangChain Tool instance
 */
export function createReadFileTool(options) {
	return tool((input) => readFileImpl(input, options), {
		name: "readFile",
		description:
			"Read the complete contents of a file from the file system. Supports pagination with offset/limit for large files. Returns lines in LINE_NUM|CONTENT format.",
		schema: z.object({
			path: z.string().describe("Path to the file to read"),
			offset: z.number().int().min(0).optional().describe("Zero-based line offset to start from"),
			limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
		}),
	});
}

/**
 * Create a write_file tool with runtime options
 * @param {object} options - Runtime options (allowedPaths, maxReadSize, etc.)
 * @returns {object} LangChain Tool instance
 */
export function createWriteFileTool(options) {
	return tool((input) => writeFileImpl(input, options), {
		name: "writeFile",
		description:
			"Write content to a file, creating all parent directories if they don't exist. Validates content size (max 500KB).",
		schema: z.object({
			path: z.string().describe("Path to the file to write"),
			content: z.string().describe("Content to write to the file"),
		}),
	});
}

/**
 * Create a patch tool with runtime options
 * @param {object} options - Runtime options (allowedPaths, maxReadSize, etc.)
 * @returns {object} LangChain Tool instance
 */
export function createPatchTool(options) {
	return tool((input) => patchImpl(input, options), {
		name: "patch",
		description:
			"Apply a patch to a file using fuzzy pattern matching. Attempts up to 9 strategies (exact, whitespace trimming, case-insensitive, etc.) to find the oldStr. Returns a unified diff.",
		schema: z.object({
			path: z.string().describe("Path to the file to patch"),
			oldStr: z.string().describe("Text to find and replace"),
			newStr: z.string().describe("Replacement text"),
		}),
	});
}

/**
 * Create a search_files tool with runtime options
 * @param {object} options - Runtime options (allowedPaths, maxReadSize, etc.)
 * @returns {object} LangChain Tool instance
 */
export function createSearchFilesTool(options) {
	return tool((input) => searchFilesImpl(input, options), {
		name: "searchFiles",
		description:
			"Search file contents using ripgrep (primary) or native fs fallback. Searches for a regex pattern in files within the given path. Can search by filename or content.",
		schema: z.object({
			path: z.string().describe("Path to directory or file to search within"),
			pattern: z.string().describe("Regex pattern to search for"),
			target: z
				.enum(["content", "filename", "both"])
				.default("content")
				.describe("What to search: file content, filenames, or both"),
			maxResults: z
				.number()
				.int()
				.positive()
				.default(20)
				.describe("Maximum number of results to return"),
		}),
	});
}
