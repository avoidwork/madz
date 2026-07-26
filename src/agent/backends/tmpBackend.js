import { FilesystemBackend } from "deepagents";
import { join } from "node:path";
import fs from "node:fs/promises";

/**
 * Create a FilesystemBackend sandboxed to the tmp/ directory.
 * @returns {FilesystemBackend}
 */
export async function createTmpBackend() {
	const tmpDir = join(process.cwd(), "tmp/");
	await fs.mkdir(tmpDir, { recursive: true });
	return new FilesystemBackend({
		rootDir: tmpDir,
		virtualMode: true,
	});
}
