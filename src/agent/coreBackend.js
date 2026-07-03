import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend sandboxed to the current working directory.
 * @returns {FilesystemBackend}
 */
export function createCoreBackend() {
	return new FilesystemBackend({
		rootDir: process.cwd(),
		virtualMode: true,
	});
}
