import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Ensure the memory/tools directory exists by creating it if necessary.
 * @param {string} toolsDir - Path to tools directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureToolsDir(toolsDir, cwdParam = cwd) {
	const dir = join(cwdParam, toolsDir);
	await mkdir(dir, { recursive: true });
}
