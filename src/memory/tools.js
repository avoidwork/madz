import { ensureDir } from "./paths.js";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the memory/tools directory exists by creating it if necessary.
 * @param {string} toolsDir - Path to tools directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureToolsDir(toolsDir, cwdParam = loadConfig().cwd) {
	await ensureDir(cwdParam, toolsDir);
}
