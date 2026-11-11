import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Ensure the memory/context directory exists by creating it if necessary.
 * @param {string} contextDir - Path to context directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureContextDir(contextDir, cwdParam = cwd) {
	const dir = join(cwdParam, contextDir);
	await mkdir(dir, { recursive: true });
}
