import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { readMemoryFile } from "./reader.js";
import { resolveContextDir as resolveContextDirIn } from "./paths.js";
import { mapInBatches } from "./fsUtil.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

const EPHEMERAL_PREFIX = "ephemeral-";
const READ_CONCURRENCY = 16;

/**
 * Resolve the context directory to an absolute path. Relative inputs are
 * joined with `cwdParam`; absolute inputs are accepted only when they lie
 * inside `cwdParam` (anything else throws a PathContainmentError).
 * @param {string} contextDir - Directory to resolve
 * @param {string} [cwdParam] - Base directory (defaults to the configured cwd)
 * @returns {string} The resolved absolute directory
 */
export function resolveContextDir(contextDir, cwdParam = loadConfig().cwd) {
	return resolveContextDirIn(contextDir, cwdParam);
}

/**
 * The single definition of "ephemeral": the `ephemeral: true` frontmatter flag,
 * or (legacy) a filename starting with `ephemeral-`.
 * @param {string} filename - The memory file name
 * @param {Object} frontmatter - Parsed frontmatter of the file
 * @returns {boolean} Whether the file is an ephemeral memory
 */
export function isEphemeralFile(filename, frontmatter) {
	return frontmatter?.ephemeral === true || filename.startsWith(EPHEMERAL_PREFIX);
}

/**
 * Read an ephemeral memory file and extract frontmatter metadata.
 * @param {string} contextDir - Directory containing the file
 * @param {string} filename - The filename
 * @param {string} [cwdParam] - Base directory (defaults to the configured cwd)
 * @returns {Promise<{ ephemeral: boolean, expiresAt: string } | null>} Parsed metadata or null if unreadable
 */
export async function readEphemeralFile(contextDir, filename, cwdParam = loadConfig().cwd) {
	try {
		const filepath = join(resolveContextDir(contextDir, cwdParam), filename);
		const file = await readMemoryFile(filepath);
		if (!file) return null;
		return {
			ephemeral: isEphemeralFile(filename, file.frontmatter),
			expiresAt: file.frontmatter.ephemeral_expiresAt || "",
		};
	} catch (err) {
		logger.warn(`[expireEphemeral] Failed to read ephemeral file ${filename}: ${err.message}`);
		return null;
	}
}

/**
 * Check if an ephemeral memory entry has expired. An empty/missing `expiresAt`
 * means "no expiry"; an unparseable one is treated as expired (fail closed).
 * @param {string|Date} expiresAt - The expiresAt ISO string
 * @param {Date} [now] - Current date (defaults to new Date())
 * @returns {boolean} Whether the memory is expired
 * @throws {RangeError} When `now` is not a valid date
 */
export function isExpired(expiresAt, now) {
	const checkNow = now || new Date();
	if (Number.isNaN(new Date(checkNow).getTime())) {
		throw new RangeError("isExpired: invalid 'now' date");
	}
	if (!expiresAt) return false;
	const expiry = new Date(expiresAt).getTime();
	if (Number.isNaN(expiry)) {
		logger.warn(`[expireEphemeral] Invalid expiresAt "${String(expiresAt)}"; treating as expired`);
		return true;
	}
	return expiry < new Date(checkNow).getTime();
}

/**
 * Remove expired ephemeral memory files from the context directory.
 * Missing directories and unreadable files are logged and skipped rather than
 * aborting the sweep.
 * @param {string} contextDir - Directory to scan and clean
 * @param {string} [nowStr] - Optional ISO timestamp for deterministic testing
 * @param {string} [cwdParam] - Base directory (defaults to the configured cwd)
 * @returns {Promise<number>} Number of files removed
 * @throws {RangeError} When `nowStr` is not a valid date
 */
export async function expireEphemeralMemories(contextDir, nowStr, cwdParam = loadConfig().cwd) {
	const checkNow = nowStr ? new Date(nowStr) : new Date();
	if (Number.isNaN(checkNow.getTime())) {
		throw new RangeError(`expireEphemeralMemories: invalid nowStr "${nowStr}"`);
	}
	const resolvedDir = resolveContextDir(contextDir, cwdParam);
	let files;
	try {
		files = await readdir(resolvedDir);
	} catch (err) {
		const level = err.code === "ENOENT" ? "debug" : "warn";
		logger[level](`[expireEphemeralMemories] Failed to read directory: ${err.message}`);
		return 0;
	}
	const results = await mapInBatches(
		files.filter((f) => f.endsWith(".md")),
		READ_CONCURRENCY,
		async (file) => {
			const filepath = join(resolvedDir, file);
			let parsed;
			try {
				const info = await readMemoryFile(filepath);
				if (!info) return 0;
				parsed = info.frontmatter;
			} catch (err) {
				logger.warn(`[expireEphemeral] Failed to read ${file}: ${err.message}`);
				return 0;
			}
			if (!isEphemeralFile(file, parsed) || !isExpired(parsed.ephemeral_expiresAt, checkNow)) {
				return 0;
			}
			try {
				await unlink(filepath);
				return 1;
			} catch (unlinkErr) {
				if (unlinkErr.code !== "ENOENT") {
					logger.warn(`[expireEphemeral] Failed to delete ${file}: ${unlinkErr.message}`);
				}
				return 0;
			}
		},
	);
	return results.reduce((a, b) => a + b, 0);
}
