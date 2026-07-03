import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend sandboxed to /tmp.
 * Used as a fallback backend for operations that don't fit other routes.
 * @returns {FilesystemBackend}
 */
export function createDmzBackend() {
	return new FilesystemBackend({
		rootDir: '/tmp',
		virtualMode: false,
	});
}
