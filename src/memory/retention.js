import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";
import { PROFILE_FILENAME, REFLECTION_FILENAME, resolveInsideReal } from "./paths.js";
import { mapInBatches } from "./fsUtil.js";

const STAT_BATCH_SIZE = 32;
const DAY_MS = 24 * 60 * 60 * 1000;
const PROTECTED_FILES = new Set([PROFILE_FILENAME, REFLECTION_FILENAME]);

/**
 * List removable memory files (regular .md files other than profile/reflection)
 * with their mtimes. Stat failures are logged and the file is skipped.
 * @param {string} fullPath - Absolute directory
 * @returns {Promise<Array<{ filepath: string, mtime: number }>>} Entries
 */
async function listMemoryEntries(fullPath) {
	const dirents = await readdir(fullPath, { withFileTypes: true });
	const names = dirents
		.filter((d) => d.isFile() && d.name.endsWith(".md") && !PROTECTED_FILES.has(d.name))
		.map((d) => d.name);
	const entries = await mapInBatches(names, STAT_BATCH_SIZE, async (filename) => {
		const filepath = join(fullPath, filename);
		try {
			return { filepath, mtime: (await stat(filepath)).mtimeMs };
		} catch (err) {
			if (err.code !== "ENOENT")
				logger.warn(`[retention] Failed to stat ${filepath}: ${err.message}`);
			return null;
		}
	});
	return entries.filter(Boolean);
}

/**
 * Unlink files, counting only those actually removed. Failures are logged.
 * @param {string[]} filepaths - Files to remove
 * @returns {Promise<number>} Number of files removed
 */
async function removeFiles(filepaths) {
	let removed = 0;
	for (const filepath of filepaths) {
		try {
			await unlink(filepath);
			removed++;
		} catch (err) {
			if (err.code !== "ENOENT")
				logger.warn(`[retention] Failed to delete ${filepath}: ${err.message}`);
		}
	}
	return removed;
}

/**
 * Resolve and list a directory, logging failures. Returns null when unusable.
 * @param {string} directory - Directory relative to the base
 * @param {string} base - Base directory
 * @returns {Promise<Array<{ filepath: string, mtime: number }> | null>} Entries or null
 */
async function loadEntries(directory, base) {
	try {
		const fullPath = await resolveInsideReal(base, directory);
		return await listMemoryEntries(fullPath);
	} catch (err) {
		const level = err.code === "ENOENT" ? "debug" : "warn";
		logger[level](`[retention] Cannot read directory ${directory}: ${err.message}`);
		return null;
	}
}

/**
 * Remove memory files older than the retention policy allows. profile.md and
 * reflection.md are never removed. Ephemeral files are subject to the same
 * age policy; their own expiry is handled by expireEphemeralMemories.
 * @param {string} directory - The memory directory to clean (relative to cwd)
 * @param {number} [retentionDays] - Maximum age in days (finite, >= 0)
 * @param {string} [cwdParam] - Base directory (defaults to the configured cwd)
 * @returns {Promise<number>} Number of files removed
 * @throws {RangeError} When retentionDays is not a finite non-negative number
 */
export async function cleanRetainedMemory(directory, retentionDays = 90, cwdParam) {
	if (!Number.isFinite(retentionDays) || retentionDays < 0) {
		throw new RangeError("retentionDays must be a finite non-negative number");
	}
	const entries = await loadEntries(directory, cwdParam ?? loadConfig().cwd);
	if (!entries) return 0;
	const cutoff = Date.now() - retentionDays * DAY_MS;
	return removeFiles(entries.filter((e) => e.mtime < cutoff).map((e) => e.filepath));
}

/**
 * Enforce maximum entry count across a memory directory, removing the oldest
 * files first. profile.md and reflection.md are neither counted nor removed.
 * @param {string} directory - The memory directory to clean (relative to cwd)
 * @param {number} [maxEntries] - Maximum number of files to keep (integer >= 0)
 * @param {string} [cwdParam] - Base directory (defaults to the configured cwd)
 * @returns {Promise<number>} Number of files removed
 * @throws {RangeError} When maxEntries is not a non-negative integer
 */
export async function enforceMaxEntries(directory, maxEntries = 1000, cwdParam) {
	if (!Number.isInteger(maxEntries) || maxEntries < 0) {
		throw new RangeError("maxEntries must be a non-negative integer");
	}
	const entries = await loadEntries(directory, cwdParam ?? loadConfig().cwd);
	if (!entries || entries.length <= maxEntries) return 0;
	entries.sort((a, b) => a.mtime - b.mtime);
	return removeFiles(entries.slice(0, entries.length - maxEntries).map((e) => e.filepath));
}
