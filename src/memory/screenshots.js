import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Ensure the memory/screenshots directory exists by creating it if necessary.
 * @param {string} screenshotsDir - Path to screenshots directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureScreenshotsDir(screenshotsDir, cwdParam = cwd) {
	const dir = join(cwdParam, screenshotsDir);
	await mkdir(dir, { recursive: true });
}
