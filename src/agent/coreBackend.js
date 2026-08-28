import { LocalShellBackend } from "deepagents";

/**
 * Create a LocalShellBackend sandboxed to the current working directory.
 * @returns {LocalShellBackend}
 */
export function createCoreBackend() {
	return new LocalShellBackend({
		rootDir: process.cwd(),
		virtualMode: false,
		inheritEnv: true,
	});
}
