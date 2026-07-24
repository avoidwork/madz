import { FilesystemBackend } from "deepagents";
import { join } from "node:path";
import { loadConfig } from "../../config/loader.js";

/**
 * Create a FilesystemBackend for the memory context directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createContextBackend(cwd) {
	const baseDir = cwd || process.cwd();
	const config = loadConfig();
	const contextDir = join(baseDir, config.memory.contextDir);
	return new FilesystemBackend({
		rootDir: contextDir,
		virtualMode: true,
	});
}
