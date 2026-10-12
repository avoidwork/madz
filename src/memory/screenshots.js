import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the memory/screenshots directory exists by creating it if necessary.
 * @param {string} screenshotsDir - Path to screenshots directory
 * @param {string} [cwdParam] - Base directory (defaults to config.cwd)
 * @returns {Promise<void>}
 */
export async function ensureScreenshotsDir(screenshotsDir, cwdParam = loadConfig().cwd) {
	const dir = join(cwdParam, screenshotsDir);
	await mkdir(dir, { recursive: true });
}
