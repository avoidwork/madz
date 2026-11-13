import { ensureDir } from "./paths.js";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the memory/context directory exists by creating it if necessary.
 * @param {string} contextDir - Path to context directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureContextDir(contextDir, cwdParam = loadConfig().cwd) {
	await ensureDir(cwdParam, contextDir);
}
