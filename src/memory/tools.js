import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the memory/tools directory exists by creating it if necessary.
 * @param {string} toolsDir - Path to tools directory
 * @param {string} [cwdParam] - Base directory (defaults to config.cwd)
 * @returns {Promise<void>}
 */
export async function ensureToolsDir(toolsDir, cwdParam = loadConfig().cwd) {
	const dir = join(cwdParam, toolsDir);
	await mkdir(dir, { recursive: true });
}
