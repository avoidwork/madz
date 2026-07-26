import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend sandboxed to the src/ directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createSrcBackend(cwd) {
	const baseDir = cwd || process.cwd();
	return new FilesystemBackend({
		rootDir: join(baseDir, "src/"),
		virtualMode: true,
	});
}
