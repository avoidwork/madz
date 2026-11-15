import { ensureDir } from "../memory/paths.js";
import { loadConfig } from "../config/loader.js";

/**
 * Ensure the downloads directory exists by creating it if necessary.
 * Downloads from the `api` tool's `download` field are saved here by default.
 * @param {string} downloadsDir - Path to the downloads directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureDownloadsDir(downloadsDir, cwdParam = loadConfig().cwd) {
	await ensureDir(cwdParam, downloadsDir);
}
