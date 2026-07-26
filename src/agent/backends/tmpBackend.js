import { LocalShellBackend } from "deepagents";
import { join } from "node:path";

const TMP_TIMEOUT = 60;

/**
 * Create a LocalShellBackend sandboxed to the tmp/ directory for use as
 * a scratch workspace — agents write and execute shell scripts here.
 * @returns {Promise<LocalShellBackend>}
 */
export async function createTmpBackend() {
	const tmpDir = join(process.cwd(), "tmp/");
	return LocalShellBackend.create({
		rootDir: tmpDir,
		virtualMode: true,
		inheritEnv: true,
		timeout: TMP_TIMEOUT,
	});
}
