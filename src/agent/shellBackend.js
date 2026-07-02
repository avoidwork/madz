import { LocalShellBackend } from "deepagents";
import { loadConfig } from "../config/loader.js";

/**
 * Create a LocalShellBackend for command execution.
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {LocalShellBackend}
 */
export function createShellBackend(cwd) {
	const config = loadConfig();
	const baseDir = cwd || process.cwd();
	return new LocalShellBackend({
		rootDir: baseDir,
		inheritEnv: true,
		timeout: config.sandbox?.timeout?.seconds ?? 120,
	});
}
