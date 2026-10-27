import { filterUrl } from "../sandbox/urlFilter.js";
import { resolvePath } from "../sandbox/pathResolver.js";
import {
	stat as statAsync,
	access,
	readdir,
	readFile as readFileNode,
	stat,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { getProjectCwd } from "../workspace/project.js";

const execFileAsync = promisify(execFile);

/**
 * Resolve the effective base directory for file tools.
 * Prefers the active project cwd (set by the TUI when the user selects a
 * project), then falls back to `config.cwd`. This mirrors the `@` file picker,
 * which globs the active project directory.
 * @returns {string} The base directory for resolving relative paths
 */
export function resolveBaseDir() {
	return getProjectCwd() || loadConfig().cwd || process.cwd();
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
 * Validate a file path against the sandbox allowlist.
 * @param {string} filePath - The file path to validate
 * @param {string[]} allowedPaths - List of allowed sandbox directories
 * @returns {{ allowed: boolean, path: string, error?: string }}
 */
export function validatePath(filePath, allowedPaths) {
	const { allowed, path } = resolvePath(filePath, allowedPaths);
	if (!allowed) {
		return { allowed: false, path, error: `Access denied: ${filePath} is outside sandbox scope` };
	}
	return { allowed: true, path };
}

/**
 * Validate a URL against blocked schemes and optional allowlist.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Optional URL host allowlist
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateUrl(url, allowlist = []) {
	if (!url || typeof url !== "string") {
		return { allowed: false, reason: "Invalid URL" };
	}
	return filterUrl(url, allowlist);
}

/**
 * Perform an HTTP GET request with configurable timeout and URL validation.
 * @param {string} url - The URL to fetch
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @param {string[]} [allowlist=[]] - Optional URL host allowlist
 * @returns {Promise<{ ok: boolean, body?: string, error?: string }>}
 */
export async function fetchWithTimeout(url, timeoutMs = 5000, allowlist = []) {
	const validation = validateUrl(url, allowlist);
	if (!validation.allowed) {
		return { ok: false, error: validation.reason };
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		const body = await response.text();
		return {
			ok: response.ok,
			body: response.ok ? body : undefined,
			error: response.ok ? undefined : `HTTP ${response.status}`,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const reason =
			err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message;
		return { ok: false, error: reason };
	}
}

/**
 * Read a file and check against max size limit.
 * @param {string} filePath - Resolved file path
 * @param {string} maxReadSize - Size limit string (e.g. "1mb")
 * @returns {Promise<{ ok: boolean, size?: number, limit?: number, error?: string }>}
 */
export async function checkFileLimit(filePath, maxReadSize) {
	try {
		await access(filePath);
	} catch (_err) {
		return { ok: false, error: `File not found: ${filePath}` };
	}

	const stats = await statAsync(filePath);
	const maxSizeBytes = parseSizeString(maxReadSize);

	if (stats.size > maxSizeBytes) {
		return {
			ok: false,
			size: stats.size,
			limit: maxSizeBytes,
			error: `File size (${stats.size} bytes) exceeds max read size (${maxReadSize}). Use limit/offset to paginate.`,
		};
	}

	return { ok: true, size: stats.size };
}

/**
 * Parse a size string like "1mb", "512kb", "1024" to bytes.
 * @param {string} sizeStr - Size string
 * @returns {number} Size in bytes
 */
export function parseSizeString(sizeStr) {
	const match = sizeStr
		.trim()
		.toLowerCase()
		.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
	if (!match) {
		return 1024 * 1024; // default 1mb
	}

	const value = parseFloat(match[1]);
	const unit = match[2] || "b";
	const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };

	return Math.floor(value * (multipliers[unit] || 1));
}
