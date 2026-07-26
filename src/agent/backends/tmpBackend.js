import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend sandboxed to the tmp/ directory.
 * @returns {FilesystemBackend}
 */
export function createTmpBackend() {
	return new FilesystemBackend({
		rootDir: join(process.cwd(), "tmp/"),
		virtualMode: true,
	});
}
