import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend rooted at the filesystem root.
 * @returns {FilesystemBackend}
 */
export function createCoreBackend() {
	const baseDir = '/';
	return new FilesystemBackend({
		rootDir: baseDir,
		virtualMode: false,
	});
}
