import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend sandboxed to the prompts/ directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createPromptsBackend(cwd) {
	const baseDir = cwd || process.cwd();
	return new FilesystemBackend({
		rootDir: join(baseDir, "prompts/"),
		virtualMode: true,
	});
}
