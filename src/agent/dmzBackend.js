import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend sandboxed to the current working directory.
 * @returns {FilesystemBackend}
 */
export function createDmzBackend() {
	return new FilesystemBackend({
		rootDir: '/',
		virtualMode: false,
	});
}
