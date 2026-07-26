import { LocalShellBackend } from "deepagents";
import { join } from "node:path";

const WORKSPACE_TIMEOUT = 60;

/**
 * Create a LocalShellBackend sandboxed to the workspace/ directory, enabling
 * shell commands (npm, node, linters, etc.) within a scoped prefix.
 * @returns {LocalShellBackend}
 */
export function createWorkspaceBackend() {
	const workspaceDir = join(process.cwd(), "workspace/");
	return new LocalShellBackend({
		rootDir: workspaceDir,
		virtualMode: true,
		inheritEnv: true,
		timeout: WORKSPACE_TIMEOUT,
	});
}
