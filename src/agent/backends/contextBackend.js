import { FilesystemBackend } from "deepagents";
import { join } from "node:path";
import { loadConfig } from "../../config/loader.js";

/**
 * Create a FilesystemBackend for the memory context directory.
 * @returns {FilesystemBackend}
 */
export function createContextBackend() {
	const config = loadConfig();
	const contextDir = join(process.cwd(), config.memory.contextDir);
	return new FilesystemBackend({
		rootDir: contextDir,
		virtualMode: true,
	});
}
