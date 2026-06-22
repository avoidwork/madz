import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = "/tmp";
const LOG_PATTERN = /^sub-agent-[a-zA-Z0-9-]+\.log$/;

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
 * @param {string} [sessionId] - Optional session ID to filter by
 * @returns {Promise<Array<{ pid: number, sessionId: string, file: string, size: number, modified: string, running: boolean }>>}
 */
async function listLogs(sessionId) {
	const files = await readdir(LOG_DIR);
	const logs = [];

	for (const file of files) {
		const match = file.match(LOG_PATTERN);
		if (match) {
			const id = match[1];
			const filePath = join(LOG_DIR, file);
			const stats = await stat(filePath);

			// If sessionId filter is provided, only include matching logs
			if (sessionId && id !== sessionId) {
				continue;
			}

			// Try to parse as numeric PID for backward compatibility
			const pid = /^\d+$/.test(id) ? parseInt(id, 10) : null;

			logs.push({
				pid,
				sessionId: id,
				file,
				size: stats.size,
				modified: stats.mtime.toISOString(),
				running: pid !== null && isProcessRunning(pid),
			});
		}
	}

	return logs.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

/**
 * Read a subAgent log file.
 * @param {number|string} id - Process ID or session ID of the log to read
 * @returns {Promise<{ pid: number, sessionId: string, content: string }>}
 */
async function readLog(id) {
	const filePath = join(LOG_DIR, `sub-agent-${id}.log`);
	const content = await readFile(filePath, "utf-8");
	// Try to parse as numeric PID for backward compatibility
	const pid = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null;
	return {
		pid,
		sessionId: String(id),
		content,
	};
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
				const { action, pid, sessionId, maxAgeHours } = input;

				switch (action) {
					case "list": {
						const logs = await listLogs(sessionId);
						return JSON.stringify({ ok: true, logs });
					}

					case "read": {
						if (pid === undefined && sessionId === undefined) {
							return JSON.stringify({
								ok: false,
								error: "PID or sessionId is required for 'read' action",
							});
						}
						// sessionId takes precedence, fall back to pid for backward compatibility
						const id = sessionId !== undefined ? sessionId : pid;
						const result = await readLog(id);
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
						"Action to perform: 'list' shows all subAgent logs, 'read' reads a specific log by PID or sessionId, 'cleanup' removes old logs",
					),
				pid: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Process ID (required for 'read' action if sessionId not provided)"),
				sessionId: z
					.string()
					.optional()
					.describe("Session ID (alternative to pid for 'read' action, or filter for 'list' action)"),
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