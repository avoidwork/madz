import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend with unrestricted root access.
 * Used for context directory operations where sandboxing is not required.
 * @returns {FilesystemBackend}
 */
export function createDmzBackend() {
	return new FilesystemBackend({
		rootDir: '/',
		virtualMode: false,
	});
}
