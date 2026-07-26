import { LocalShellBackend } from "deepagents";
import { join } from "node:path";

const SRC_TIMEOUT = 60;

/**
 * Create a LocalShellBackend sandboxed to the src/ directory, enabling
 * shell commands (npm, node, linters, etc.) within a scoped prefix.
 * @returns {LocalShellBackend}
 */
export function createSrcBackend() {
	const srcDir = join(process.cwd(), "src/");
	return new LocalShellBackend({
		rootDir: srcDir,
		virtualMode: true,
		inheritEnv: true,
		timeout: SRC_TIMEOUT,
	});
}
