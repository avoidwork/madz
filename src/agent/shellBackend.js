import { LocalShellBackend } from "deepagents";
import { loadConfig } from "../config/loader.js";

/**
 * Create a LocalShellBackend for command execution.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {LocalShellBackend}
 */
export function createShellBackend(_cwd) {
	const config = loadConfig();
	return new LocalShellBackend({
		rootDir: "/",
		inheritEnv: true,
		timeout: config.sandbox?.timeout?.seconds ?? 120,
	});
}
