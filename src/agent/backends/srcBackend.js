import { LocalShellBackend } from "deepagents";
import { join } from "node:path";

const SRC_TIMEOUT = 60;

/**
 * Create a LocalShellBackend sandboxed to the src/ directory, enabling
 * shell commands (npm, node, linters, etc.) within a scoped prefix.
 * @returns {Promise<LocalShellBackend>}
 */
export async function createSrcBackend() {
	const srcDir = join(process.cwd(), "src/");
	return LocalShellBackend.create({
		rootDir: srcDir,
		virtualMode: true,
		inheritEnv: true,
		timeout: SRC_TIMEOUT,
	});
}
