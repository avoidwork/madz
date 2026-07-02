import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend for the memory context directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createContextBackend(cwd) {
	const baseDir = cwd || process.cwd();
	const contextDir = join(baseDir, "memory", "context");
	return new FilesystemBackend({
		rootDir: contextDir,
		virtualMode: true,
	});
}
