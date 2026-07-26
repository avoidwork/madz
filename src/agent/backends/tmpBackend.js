import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend sandboxed to the tmp/ directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createTmpBackend(cwd) {
	const baseDir = cwd || process.cwd();
	return new FilesystemBackend({
		rootDir: join(baseDir, "tmp/"),
		virtualMode: true,
	});
}
