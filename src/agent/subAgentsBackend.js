import { FilesystemBackend } from "deepagents";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { loadConfig } from "../config/loader.js";

/**
 * Create a FilesystemBackend for the sub-agents memory directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createSubAgentsBackend(cwd) {
	const baseDir = cwd || process.cwd();
	const config = loadConfig();
	const subAgentsDir = join(baseDir, config.memory.subAgentsDir);
	if (!existsSync(subAgentsDir)) {
		mkdirSync(subAgentsDir, { recursive: true });
	}
	return new FilesystemBackend({
		rootDir: subAgentsDir,
		virtualMode: true,
	});
}
