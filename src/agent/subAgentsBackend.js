import { FilesystemBackend } from "deepagents";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

/**
 * Create a FilesystemBackend for the sub-agents memory directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createSubAgentsBackend(cwd) {
	const baseDir = cwd || process.cwd();
	const subAgentsDir = join(baseDir, "memory", "sub-agents");
	if (!existsSync(subAgentsDir)) {
		mkdirSync(subAgentsDir, { recursive: true });
	}
	return new FilesystemBackend({
		rootDir: subAgentsDir,
		virtualMode: true,
	});
}
