import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	access,
	appendFile,
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile as readFileNode,
	rename,
	rm,
	stat,
	unlink,
	writeFile as writeFileNode,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { validatePath, checkFileLimit } from "../common.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";
import { fuzzyMatch, levenshteinDistance, lineNumberAt, suggestSimilarLines } from "./match.js";

export { fuzzyMatch, levenshteinDistance };

const execFileAsync = promisify(execFile);
const DIFF_TIMEOUT_MS = 10_000;

const config = loadConfig();

const MAX_LIST_ENTRIES = 1000;
const MAX_REPORTED_MATCHES = 10;
const BINARY_SNIFF_BYTES = 8000;
const SKIPPED_DIRS = new Set([".git", "node_modules"]);
const VALID_ACTIONS = [
	"read",
	"write",
	"edit",
	"delete",
	"append",
	"list",
	"mkdir",
	"move",
	"copy",
];

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

// --- Helpers ---

/**
 * Suggest similar filenames when a file is not found.
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
				if (entry === baseName) continue;
				const entryWithoutExt = entry.replace(/\.[^.]+$/, "");
				const distance = levenshteinDistance(
					nameWithoutExt.toLowerCase(),
					entryWithoutExt.toLowerCase(),
				);
				if (distance <= 2) suggestions.push(entry);
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
 * Build the standard "file not found" error, with a suggestion when possible.
 * @param {string} filePath - The missing path
 * @returns {Promise<{ ok: false, error: string }>} Error result
 */
async function notFound(filePath) {
	const suggestion = await suggestSimilarFile(filePath);
	return { ok: false, error: `File not found: ${filePath}${suggestion ? `\n${suggestion}` : ""}` };
}

/**
 * Wrap an action implementation so thrown filesystem errors become structured
 * `{ ok: false, error }` results instead of rejecting.
 * @param {(input: object, options: object) => Promise<object>} fn - Implementation
 * @returns {(input: object, options: object) => Promise<object>} Guarded implementation
 */
function guarded(fn) {
	return async (input, options) => {
		try {
			return await fn(input, options || {});
		} catch (err) {
			return { ok: false, error: err.message };
		}
	};
}

/**
 * Check that the named string fields are present on the input.
 * @param {object} input - Tool input
 * @param {string[]} fields - Required string field names
 * @returns {string | null} Error message, or null when all are present
 */
function missingField(input, fields) {
	for (const field of fields) {
		if (typeof input[field] !== "string") return `${input.action || "action"} requires '${field}'`;
	}
	return null;
}

/**
 * Validate a path for an action that needs an explicit target. Mutating actions
 * never default to the base directory.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @param {string} [field] - Input field holding the path
 * @param {{ noFollow?: boolean }} [pathOptions] - Resolver options
 * @returns {{ ok: true, path: string, realPath: string } | { ok: false, error: string }} Result
 */
function target(input, options, field = "path", pathOptions) {
	if (typeof input[field] !== "string" || input[field] === "") {
		return { ok: false, error: `${input.action || "action"} requires '${field}'` };
	}
	const resolved = validatePath(resolveFilePath(input[field]), options.allowedPaths, pathOptions);
	if (!resolved.allowed) return { ok: false, error: resolved.error };
	return { ok: true, path: resolved.path, realPath: resolved.realPath || resolved.path };
}

/**
 * Read a text file, rejecting oversized and binary files.
 * @param {string} filePath - Real path to read
 * @param {number} maxReadSize - Size limit in bytes
 * @returns {Promise<{ ok: true, content: string } | { ok: false, error: string }>} Result
 */
async function readText(filePath, maxReadSize) {
	const info = await stat(filePath).catch(() => null);
	if (info?.isDirectory()) {
		return { ok: false, error: `${filePath} is a directory. Use the list action.` };
	}
	const limitCheck = await checkFileLimit(filePath, maxReadSize);
	if (!limitCheck.ok) {
		return limitCheck.error.startsWith("File not found")
			? notFound(filePath)
			: { ok: false, error: limitCheck.error };
	}
	const buffer = await readFileNode(filePath);
	if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
		return { ok: false, error: `${filePath} appears to be a binary file.` };
	}
	return { ok: true, content: buffer.toString("utf-8") };
}

/**
 * Write a file atomically: write a temp file beside it, then rename over the
 * target, so a crash never leaves a partially written file. Preserves the mode
 * of an existing file.
 * @param {string} realPath - Real destination path
 * @param {string} content - Text to write
 * @returns {Promise<void>}
 */
async function writeAtomic(realPath, content) {
	const existing = await stat(realPath).catch(() => null);
	await mkdir(dirname(realPath), { recursive: true });
	const tmp = join(dirname(realPath), `.${basename(realPath)}.${process.pid}.${Date.now()}.tmp`);
	try {
		await writeFileNode(tmp, content, { encoding: "utf-8", mode: existing?.mode });
		await rename(tmp, realPath);
	} catch (err) {
		await unlink(tmp).catch(() => {});
		throw err;
	}
}

/**
 * Produce a unified diff with GNU `diff -u`. Both versions are written to a
 * private temporary directory (diff needs two file operands) that is always
 * removed afterwards. `diff` exits 1 when the inputs differ, which is not an error.
 * @param {string} before - Original text
 * @param {string} after - Edited text
 * @param {string} label - File name shown in the diff headers
 * @returns {Promise<string>} Unified diff, with `a/<label>` and `b/<label>` headers
 * @throws {Error} When `diff` is missing, times out, or fails
 */
async function unifiedDiff(before, after, label) {
	const dir = await mkdtemp(join(tmpdir(), "madz-diff-"));
	try {
		const a = join(dir, "a");
		const b = join(dir, "b");
		await writeFileNode(a, before, "utf-8");
		await writeFileNode(b, after, "utf-8");
		try {
			const { stdout } = await execFileAsync(
				"diff",
				["-u", "--label", `a/${label}`, "--label", `b/${label}`, "--", a, b],
				{ timeout: DIFF_TIMEOUT_MS, maxBuffer: config.sandbox.maxDiffBuffer },
			);
			return stdout.replace(/\n$/, "");
		} catch (err) {
			if (err.code === 1 && typeof err.stdout === "string") return err.stdout.replace(/\n$/, "");
			if (err.code === "ENOENT") {
				throw new Error("The 'diff' command is not installed (install GNU diffutils).", {
					cause: err,
				});
			}
			throw new Error(`diff failed: ${err.stderr || err.message}`, { cause: err });
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * Whether a path is a sandbox root or the filesystem root, which must never be
 * deleted or moved wholesale.
 * @param {string} realPath - Real path to check
 * @param {string[]} allowedPaths - Sandbox rules
 * @returns {boolean} True when the path is protected
 */
function isProtectedRoot(realPath, allowedPaths) {
	if (realPath === dirname(realPath)) return true;
	return (allowedPaths || [])
		.filter((p) => typeof p === "string" && !p.startsWith("!"))
		.some((p) => resolve(p) === realPath);
}

// --- Core logic functions (exported for testing) ---

/**
 * Execute read action logic on raw input. `offset` and `limit` work
 * independently; when either is set only the selected lines are returned.
 * @param {object} input - { path, offset?, limit? }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<{ok: boolean, content?: string, lines?: string[], totalLines?: number, hasMore?: boolean, error?: string}>} Structured result
 */
export const readImpl = guarded(async (input, options) => {
	const t = target({ ...input, path: input.path || resolveFilePath() }, options);
	if (!t.ok) return t;

	const paginated = input.offset !== undefined || input.limit !== undefined;
	const text = await readText(
		t.realPath,
		paginated
			? config.sandbox.maxPaginatedReadSize
			: options.maxReadSize || config.sandbox.maxReadSize,
	);
	if (!text.ok) return text;

	const lines = text.content.split("\n");
	if (!paginated) {
		return { ok: true, content: text.content, lines: lines.map((line, i) => `${i + 1}|${line}`) };
	}

	// A file ending in a newline yields a trailing empty element in the split.
	// Exclude it from the line count so pagination reports hasMore accurately
	// (the last page must not claim more lines exist).
	const realLineCount = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
	const offset = input.offset ?? 0;
	const end = input.limit === undefined ? realLineCount : offset + input.limit;
	return {
		ok: true,
		lines: lines.slice(offset, end).map((line, i) => `${offset + i + 1}|${line}`),
		totalLines: realLineCount,
		hasMore: end < realLineCount,
	};
});

/**
 * Execute write action logic on raw input.
 * @param {object} input - { path, content }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, bytesWritten?: number, error?: string}>} Structured result
 */
export const writeImpl = guarded(async (input, options) => {
	const missing = missingField(input, ["content"]);
	if (missing) return { ok: false, error: missing };
	const t = target(input, options);
	if (!t.ok) return t;

	const byteSize = Buffer.byteLength(input.content, "utf-8");
	if (byteSize > config.sandbox.maxWriteSize) {
		return {
			ok: false,
			error: `Content size (${byteSize} bytes) exceeds maximum allowed size (${config.sandbox.maxWriteSize} bytes).`,
		};
	}
	const info = await stat(t.realPath).catch(() => null);
	if (info?.isDirectory()) return { ok: false, error: `${t.path} is a directory` };

	await writeAtomic(t.realPath, input.content);
	return { ok: true, path: t.path, bytesWritten: byteSize };
});

/**
 * Execute append action logic on raw input. Creates the file when missing.
 * @param {object} input - { path, content }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, bytesWritten?: number, error?: string}>} Structured result
 */
export const appendImpl = guarded(async (input, options) => {
	const missing = missingField(input, ["content"]);
	if (missing) return { ok: false, error: missing };
	const t = target(input, options);
	if (!t.ok) return t;

	const byteSize = Buffer.byteLength(input.content, "utf-8");
	if (byteSize > config.sandbox.maxWriteSize) {
		return {
			ok: false,
			error: `Content size (${byteSize} bytes) exceeds maximum allowed size (${config.sandbox.maxWriteSize} bytes).`,
		};
	}
	await mkdir(dirname(t.realPath), { recursive: true });
	await appendFile(t.realPath, input.content, "utf-8");
	return { ok: true, path: t.path, bytesWritten: byteSize };
});

/**
 * Convert replacement text to the file's line-ending style.
 * @param {string} text - Replacement text
 * @param {string} eol - The file's dominant line ending
 * @returns {string} Text using the file's line endings
 */
function withEol(text, eol) {
	return text.replace(/\r?\n/g, eol);
}

/**
 * Character offsets at which each line of `content` starts.
 * @param {string} content - File text
 * @returns {number[]} Line start offsets
 */
function lineStarts(content) {
	const starts = [0];
	for (let i = content.indexOf("\n"); i !== -1; i = content.indexOf("\n", i + 1)) {
		if (i + 1 < content.length) starts.push(i + 1);
	}
	return content === "" ? [] : starts;
}

/**
 * Apply one edit to in-memory content.
 * @param {string} content - Current file text
 * @param {object} edit - { oldString?, newString, replaceAll?, startLine?, endLine? }
 * @param {string} eol - The file's line ending
 * @param {number} index - Position in the edits array, for error messages
 * @returns {{ ok: true, content: string, fuzzy: boolean, count: number } | { ok: false, error: string, suggestions?: string[], matches?: number[] }} Result
 */
function applyEdit(content, edit, eol, index) {
	const where = index === undefined ? "" : `edits[${index}]: `;
	if (typeof edit.newString !== "string") {
		return { ok: false, error: `${where}edit requires 'newString'` };
	}
	const newString = withEol(edit.newString, eol);

	if (edit.startLine !== undefined) {
		const starts = lineStarts(content);
		const total = starts.length;
		const endLine = edit.endLine ?? edit.startLine;
		if (edit.startLine < 1 || edit.startLine > total + 1 || endLine < edit.startLine - 1) {
			return { ok: false, error: `${where}invalid line range ${edit.startLine}-${endLine}` };
		}
		// Appending at the end of the file: startLine = total + 1 with endLine
		// unset is a valid insert-at-end, not an out-of-range error.
		if (endLine > total && edit.endLine === undefined) {
			const from = starts[edit.startLine - 1] ?? content.length;
			const body = newString === "" || newString.endsWith("\n") ? newString : newString + eol;
			return {
				ok: true,
				content: content.slice(0, from) + body,
				fuzzy: false,
				count: 1,
			};
		}
		if (endLine > total) {
			return { ok: false, error: `${where}endLine ${endLine} is past the last line (${total})` };
		}
		const from = starts[edit.startLine - 1] ?? content.length;
		const to = starts[endLine] ?? content.length;
		const body = newString === "" || newString.endsWith("\n") ? newString : newString + eol;
		return {
			ok: true,
			content: content.slice(0, from) + body + content.slice(to),
			fuzzy: false,
			count: 1,
		};
	}

	if (typeof edit.oldString !== "string" || edit.oldString === "") {
		return { ok: false, error: `${where}edit requires a non-empty 'oldString'` };
	}

	const matches = fuzzyMatch(edit.oldString, content).filter((m) => m.found);
	if (matches.length === 0) {
		return {
			ok: false,
			error: `${where}Could not find matching text for oldString in the file.`,
			suggestions: suggestSimilarLines(edit.oldString, content),
		};
	}
	if (matches.length > 1 && !edit.replaceAll) {
		const lines = matches.slice(0, MAX_REPORTED_MATCHES).map((m) => lineNumberAt(content, m.start));
		return {
			ok: false,
			error: `${where}Found ${matches.length} matches for oldString (lines ${lines.join(", ")}). Add surrounding context to make it unique, or set replaceAll: true.`,
			matches: lines,
		};
	}

	const targets = edit.replaceAll ? matches : [matches[0]];
	let next = content;
	// Apply back to front so earlier offsets stay valid.
	for (const m of [...targets].reverse()) {
		next = next.slice(0, m.start) + newString + next.slice(m.end);
	}
	return {
		ok: true,
		content: next,
		fuzzy: targets.some((m) => m.tier !== "exact"),
		count: targets.length,
	};
}

/**
 * Execute edit action logic on raw input. Supports a single replacement
 * (`oldString`/`newString`), a line-range replacement (`startLine`/`endLine`),
 * `replaceAll`, several edits applied atomically (`edits`), and `dryRun`.
 * @param {object} input - { path, oldString?, newString?, replaceAll?, startLine?, endLine?, edits?, dryRun? }
 * @param {object} options - { allowedPaths, maxReadSize }
 * @returns {Promise<{ok: boolean, changes?: number, diff?: string, fuzzy?: boolean, dryRun?: boolean, error?: string, suggestions?: string[], matches?: number[]}>} Structured result
 */
export const editImpl = guarded(async (input, options) => {
	const t = target(input, options);
	if (!t.ok) return t;

	const edits = input.edits ?? [input];
	if (!Array.isArray(edits) || edits.length === 0) {
		return { ok: false, error: "edit requires oldString/newString or a non-empty 'edits' array" };
	}

	const text = await readText(t.realPath, options.maxReadSize || config.sandbox.maxReadSize);
	if (!text.ok) return text;

	const eol = text.content.includes("\r\n") ? "\r\n" : "\n";
	let content = text.content;
	let changes = 0;
	let fuzzy = false;
	for (let i = 0; i < edits.length; i++) {
		const result = applyEdit(content, edits[i], eol, input.edits ? i : undefined);
		if (!result.ok) return result;
		content = result.content;
		changes += result.count;
		fuzzy ||= result.fuzzy;
	}

	const diff = await unifiedDiff(text.content, content, basename(t.path));
	if (input.dryRun) return { ok: true, changes, diff, fuzzy, dryRun: true };

	await writeAtomic(t.realPath, content);
	return { ok: true, changes, diff, fuzzy };
});

/**
 * Execute delete action logic on raw input. Directories require `recursive`.
 * A symlink is removed itself, never its target.
 * @param {object} input - { path, recursive? }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, error?: string}>} Structured result
 */
export const deleteImpl = guarded(async (input, options) => {
	const t = target(input, options, "path", { noFollow: true });
	if (!t.ok) return t;

	const info = await lstat(t.realPath);
	if (info.isDirectory()) {
		if (!input.recursive) {
			return { ok: false, error: `${t.path} is a directory. Pass recursive: true to delete it.` };
		}
		if (isProtectedRoot(t.realPath, options.allowedPaths)) {
			return { ok: false, error: `Refusing to delete protected directory ${t.path}` };
		}
		await rm(t.realPath, { recursive: true });
		return { ok: true, path: t.path };
	}
	await unlink(t.realPath);
	return { ok: true, path: t.path };
});

/**
 * Execute list action logic on raw input.
 * @param {object} input - { path?, recursive? }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, entries?: Array<{path: string, type: string, size?: number}>, truncated?: boolean, error?: string}>} Structured result
 */
export const listImpl = guarded(async (input, options) => {
	const t = target({ ...input, path: input.path || resolveFilePath() }, options);
	if (!t.ok) return t;

	const info = await stat(t.realPath);
	if (!info.isDirectory()) return { ok: false, error: `${t.path} is not a directory` };

	const entries = [];
	let truncated = false;
	const visited = new Set();
	const walk = async (dir) => {
		// Track resolved real paths so a symlinked directory cannot cause
		// infinite recursion through a loop.
		const real = await stat(dir)
			.then((s) => s.realpath)
			.catch(() => null);
		if (real && visited.has(real)) return;
		if (real) visited.add(real);
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			if (entries.length >= MAX_LIST_ENTRIES) {
				truncated = true;
				return;
			}
			const full = join(dir, entry.name);
			const type = entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file";
			const item = { path: relative(t.realPath, full), type };
			if (type === "file") item.size = (await lstat(full)).size;
			entries.push(item);
			if (input.recursive && type === "directory" && !SKIPPED_DIRS.has(entry.name)) {
				await walk(full);
			}
		}
	};
	await walk(t.realPath);
	return { ok: true, entries, truncated };
});

/**
 * Execute mkdir action logic on raw input (creates parents as needed).
 * @param {object} input - { path }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, error?: string}>} Structured result
 */
export const mkdirImpl = guarded(async (input, options) => {
	const t = target(input, options);
	if (!t.ok) return t;
	await mkdir(t.realPath, { recursive: true });
	return { ok: true, path: t.path };
});

/**
 * Shared logic for move and copy: validates both ends and refuses to clobber an
 * existing destination unless `overwrite` is set.
 * @param {object} input - { path, to, overwrite? }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ ok: true, from: object, to: object } | { ok: false, error: string }>} Result
 */
async function prepareTransfer(input, options) {
	const from = target(input, options, "path", { noFollow: input.action === "move" });
	if (!from.ok) return from;
	const to = target(input, options, "to");
	if (!to.ok) return to;
	await lstat(from.realPath);
	if (from.realPath === to.realPath) return { ok: false, error: "path and to are the same" };
	if (isProtectedRoot(from.realPath, options.allowedPaths)) {
		return { ok: false, error: `Refusing to ${input.action} protected directory ${from.path}` };
	}
	const exists = await lstat(to.realPath).then(
		() => true,
		() => false,
	);
	if (exists && !input.overwrite) {
		return { ok: false, error: `${to.path} already exists. Pass overwrite: true to replace it.` };
	}
	await mkdir(dirname(to.realPath), { recursive: true });
	return { ok: true, from, to };
}

/**
 * Execute move action logic on raw input (rename, with a copy fallback across devices).
 * @param {object} input - { path, to, overwrite? }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, to?: string, error?: string}>} Structured result
 */
export const moveImpl = guarded(async (input, options) => {
	const prepared = await prepareTransfer({ ...input, action: "move" }, options);
	if (!prepared.ok) return prepared;
	const { from, to } = prepared;
	if (input.overwrite) await rm(to.realPath, { recursive: true, force: true });
	try {
		await rename(from.realPath, to.realPath);
	} catch (err) {
		if (err.code !== "EXDEV") throw err;
		await cp(from.realPath, to.realPath, { recursive: true });
		await rm(from.realPath, { recursive: true });
	}
	return { ok: true, path: from.path, to: to.path };
});

/**
 * Execute copy action logic on raw input (files or directories).
 * @param {object} input - { path, to, overwrite? }
 * @param {object} options - { allowedPaths }
 * @returns {Promise<{ok: boolean, path?: string, to?: string, error?: string}>} Structured result
 */
export const copyImpl = guarded(async (input, options) => {
	const prepared = await prepareTransfer({ ...input, action: "copy" }, options);
	if (!prepared.ok) return prepared;
	const { from, to } = prepared;
	await cp(from.realPath, to.realPath, { recursive: true, force: Boolean(input.overwrite) });
	return { ok: true, path: from.path, to: to.path };
});

const IMPLS = {
	read: readImpl,
	write: writeImpl,
	edit: editImpl,
	delete: deleteImpl,
	append: appendImpl,
	list: listImpl,
	mkdir: mkdirImpl,
	move: moveImpl,
	copy: copyImpl,
};

/**
 * Core file logic dispatching to the individual actions.
 * @param {object} input - The tool input
 * @param {object} options - Runtime options (allowedPaths, maxReadSize)
 * @returns {Promise<{ok: boolean, ...}>} Structured result
 */
export async function fileImpl(input, options) {
	const impl = Object.hasOwn(IMPLS, input.action) ? IMPLS[input.action] : null;
	if (!impl) {
		return {
			ok: false,
			error: `Unknown action: '${input.action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
		};
	}
	return impl(input, options);
}

const editItem = z.object({
	oldString: z.string().optional().describe("Text to find (must be unique unless replaceAll)"),
	newString: z.string().describe("Replacement text"),
	replaceAll: z.boolean().optional().describe("Replace every occurrence"),
	startLine: z.number().int().min(1).optional().describe("First line of a line-range edit"),
	endLine: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Last line (inclusive) of a line-range edit"),
});

/**
 * File tool with read, write, edit, delete, append, list, mkdir, move and copy
 * actions. Uses the common `action` key pattern (like `todo` and `memory`). Every
 * path is validated against the sandbox allowlist via `validatePath`, which
 * resolves symlinks so a link cannot lead outside the sandbox.
 */
export const file = tool(
	(input) =>
		fileImpl(input, {
			allowedPaths: config.sandbox?.paths || [],
			maxReadSize: config.sandbox.maxReadSize,
		}),
	{
		name: "file",
		description:
			"File system tool. Actions: read (text file with line numbers; offset and/or limit paginate; binary files are refused), write (create/overwrite, atomic), append, edit, delete, list (directory entries), mkdir, move, copy. " +
			"edit: oldString/newString replaces one match and fails if the text matches more than once (add context, or set replaceAll). Matching is exact, then tolerant of whitespace/indentation/line-ending differences (reported as fuzzy: true). " +
			"Use startLine/endLine instead of oldString to replace a line range (endLine = startLine - 1 inserts before startLine). edits[] applies several edits atomically; dryRun previews the diff without writing. " +
			"delete needs recursive: true for directories; move/copy need 'to' and refuse an existing destination unless overwrite: true. " +
			"Every path is validated against the sandbox allowlist (symlinks are resolved). Relative paths resolve against the active project cwd; read/list default to the project cwd when path is omitted, all other actions require a path.",
		schema: z.object({
			action: z
				.enum(VALID_ACTIONS)
				.describe("Action to perform: read, write, edit, delete, append, list, mkdir, move, copy"),
			path: z
				.string()
				.optional()
				.describe(
					"Path to the file or directory. Relative paths resolve against the active project cwd. Optional only for read/list.",
				),
			to: z.string().optional().describe("Destination path (move/copy)"),
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
			content: z.string().optional().describe("Content to write or append (write/append actions)"),
			oldString: z.string().optional().describe("Text to find and replace (edit action)"),
			newString: z.string().optional().describe("Replacement text (edit action)"),
			replaceAll: z.boolean().optional().describe("Replace every occurrence (edit action)"),
			startLine: z.number().int().min(1).optional().describe("First line of a line-range edit"),
			endLine: z
				.number()
				.int()
				.min(0)
				.optional()
				.describe("Last line (inclusive) of a line-range edit"),
			edits: z
				.array(editItem)
				.optional()
				.describe("Several edits applied in order, all-or-nothing (edit action)"),
			dryRun: z.boolean().optional().describe("Preview an edit's diff without writing"),
			recursive: z.boolean().optional().describe("delete: remove directories; list: descend"),
			overwrite: z.boolean().optional().describe("move/copy: replace an existing destination"),
		}),
	},
);
