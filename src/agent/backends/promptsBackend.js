import { FilesystemBackend } from "deepagents";
import { join } from "node:path";

/**
 * Create a FilesystemBackend sandboxed to the prompts/ directory.
 * @returns {FilesystemBackend}
 */
export function createPromptsBackend() {
	return new FilesystemBackend({
		rootDir: join(process.cwd(), "prompts/"),
		virtualMode: true,
	});
}
