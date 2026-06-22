import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = "/tmp";
const LOG_PATTERN = /^sub-agent-(\d+)\.log$/;

/**
 * Check if a process is still running.
 * @param {number} pid - Process ID to check
 * @returns {boolean} True if the process is running
 */
function isProcessRunning(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * List all subAgent log files.
 * @returns {Promise<Array<{ pid: number, file: string, size: number, modified: string, running: boolean }>>}
 */
async function listLogs() {
	const files = await readdir(LOG_DIR);
	const logs = [];

	for (const file of files) {
		const match = file.match(LOG_PATTERN);
		if (match) {
			const pid = parseInt(match[1], 10);
			const filePath = join(LOG_DIR, file);
			const stats = await stat(filePath);

			logs.push({
				pid,
				file,
				size: stats.size,
				modified: stats.mtime.toISOString(),
				running: isProcessRunning(pid),
			});
		}
	}

	return logs.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

/**
 * Read a subAgent log file.
 * @param {number} pid - Process ID of the log to read
 * @returns {Promise<{ pid: number, content: string }>}
 */
async function readLog(pid) {
	const filePath = join(LOG_DIR, `sub-agent-${pid}.log`);
	const content = await readFile(filePath, "utf-8");
	return { pid, content };
}

/**
 * Clean up old subAgent log files.
 * @param {number} [maxAgeHours=24] - Maximum age in hours before cleanup
 * @returns {Promise<{ removed: number }>}
 */
async function cleanupLogs(maxAgeHours = 24) {
	const files = await readdir(LOG_DIR);
	const now = Date.now();
	let removed = 0;

	for (const file of files) {
		const match = file.match(LOG_PATTERN);
		if (match) {
			const filePath = join(LOG_DIR, file);
			const stats = await stat(filePath);
			const ageMs = now - stats.mtimeMs;

			if (ageMs > maxAgeHours * 60 * 60 * 1000) {
				await unlink(filePath);
				removed++;
			}
		}
	}

	return { removed };
}

/**
 * Create a subAgentLog tool for managing and reading subAgent log files.
 * @returns {object} LangChain Tool instance
 */
export function createSubAgentLogTool() {
	return tool(
		async (input) => {
			try {
				const { action, pid, maxAgeHours } = input;

				switch (action) {
					case "list": {
						const logs = await listLogs();
						return JSON.stringify({ ok: true, logs });
					}

					case "read": {
						if (pid === undefined || pid === null) {
							return JSON.stringify({
								ok: false,
								error: "PID is required for 'read' action",
							});
						}
						const result = await readLog(pid);
						return JSON.stringify({ ok: true, ...result });
					}

					case "cleanup": {
						const result = await cleanupLogs(maxAgeHours);
						return JSON.stringify({ ok: true, ...result });
					}

					default:
						return JSON.stringify({
							ok: false,
							error: `Unknown action: ${action}. Use 'list', 'read', or 'cleanup'.`,
						});
				}
			} catch (err) {
				return JSON.stringify({
					ok: false,
					result: "",
					error: `subAgentLog error: ${err.message}`,
				});
			}
		},
		{
			name: "subAgentLog",
			description:
				"Manage and read subAgent log files. Supports 'list' to show all active logs with PID and status, 'read' to read a specific log by PID, and 'cleanup' to remove old logs beyond a configurable age threshold.",
			schema: z.object({
				action: z
					.enum(["list", "read", "cleanup"])
					.describe(
						"Action to perform: 'list' shows all subAgent logs, 'read' reads a specific log by PID, 'cleanup' removes old logs",
					),
				pid: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Process ID (required for 'read' action)"),
				maxAgeHours: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum age in hours before cleanup (default: 24)"),
			}),
		},
	);
}