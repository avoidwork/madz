import { ensureDir } from "./paths.js";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the memory/screenshots directory exists by creating it if necessary.
 * Created with owner-only permissions since screenshots may be sensitive.
 * @param {string} screenshotsDir - Path to screenshots directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureScreenshotsDir(screenshotsDir, cwdParam = loadConfig().cwd) {
	await ensureDir(cwdParam, screenshotsDir);
}
