import { FilesystemBackend } from "deepagents";

/**
 * Create a FilesystemBackend rooted at the working directory.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {FilesystemBackend}
 */
export function createCoreBackend(cwd) {
	const baseDir = '/';
	return new FilesystemBackend({
		rootDir: baseDir,
		virtualMode: false,
	});
}
