import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend for the sub-agents memory directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createSubAgentsBackend(cwd) {
	const baseDir = cwd || process.cwd();
	const subAgentsDir = join(baseDir, "memory", "sub-agents");
	return new FilesystemBackend({
		rootDir: subAgentsDir,
		virtualMode: true,
	});
}
