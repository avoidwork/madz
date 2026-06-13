/**
 * Handle process timeout by sending SIGTERM, then SIGKILL after grace period.
 * @param {import("node:child_process").ChildProcess} child - The spawned child process
 * @param {Object} [options] - Configuration
 * @param {number} [options.seconds=30] - Timeout before SIGTERM
 * @param {number} [options.gracePeriod=5] - Seconds between SIGTERM and SIGKILL
 * @returns {Promise<string>} "terminated", "killed", or "running"
 */
export async function handleTimeout(child, options = {}) {
	const { seconds = 30, gracePeriod = 5 } = options;

	return new Promise((resolve) => {
		const timerId = setTimeout(() => {
			if (child.exitCode !== null) {
				clearTimeout(timerId);
				resolve("terminated");
				return;
			}

			// Send SIGTERM first
			child.kill("SIGTERM");

			// Wait for graceful exit, then SIGKILL
			const killTimer = setTimeout(() => {
				if (child.exitCode !== null) {
					clearTimeout(killTimer);
					resolve("terminated");
					return;
				}
				child.kill("SIGKILL");
				resolve("killed");
			}, gracePeriod * 1000);
		}, seconds * 1000);
	});
}
