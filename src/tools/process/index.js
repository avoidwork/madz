import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "node:child_process";
import { logger } from "../../shared/logger.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

/**
 * Process tracker shared between shell and process tools.
 * Maps process IDs to process entry objects.
 */
const config = loadConfig();

export const processTracker = new Map();
let nextPid = 1000;

/**
 * Record a background process in the tracker.
 * @param {import("node:child_process").ChildProcess} child - The child process
 * @param {string} command - The command that was executed
 * @returns {number} The assigned PID
 */
export function trackProcess(child, command) {
	const pid = nextPid++;
	processTracker.set(pid, {
		pid,
		child,
		command,
		status: "running",
		startTime: Date.now(),
		stdout: "",
		stderr: "",
	});

	child.stdout.on("data", (data) => {
		const entry = processTracker.get(pid);
		if (entry) {
			entry.stdout += data.toString();
		}
	});

	child.stderr.on("data", (data) => {
		const entry = processTracker.get(pid);
		if (entry) {
			entry.stderr += data.toString();
		}
	});

	child.on("exit", (code) => {
		const entry = processTracker.get(pid);
		if (entry) {
			entry.status = code === 0 ? "exited" : `exited:${code}`;
		}
	});

	child.on("error", () => {
		const entry = processTracker.get(pid);
		if (entry) {
			entry.status = "error";
		}
	});

	return pid;
}

/**
 * Escape '--' sequences in a command so the tool parser doesn't treat them
 * as parameter delimiters.
 * @param {string} command - Raw shell command
 * @returns {string} Escaped command
 */
function escapeCommand(command) {
	return command.replace(/--/g, "\\-\\-");
}

/**
 * Execute a command in foreground mode.
 * @param {string} command - Shell command to execute
 * @returns {Promise<{ok: boolean, exitCode?: number, stdout?: string, stderr?: string, error?: string}>} Command execution result
 */
function executeForeground(command) {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let exitCode = -1;

		const child = spawn("sh", ["-c", escapeCommand(command)], {
			cwd: getProjectCwd() || config.cwd || process.cwd(),
			timeout: 30000,
		});

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("exit", (code) => {
			exitCode = code || 0;
		});

		child.on("close", () => {
			resolve({ ok: true, exitCode, stdout: stdout.trim(), stderr: stderr.trim() });
		});

		child.on("error", (err) => {
			resolve({ ok: false, error: err.message });
		});
	});
}

/**
 * Execute a command in background mode with stdout/stderr capture.
 * @param {string} command - Shell command to execute
 * @returns {{ok: boolean, pid?: number, command?: string, error?: string}} Background process start result
 */
function executeBackground(command) {
	try {
		const child = spawn("sh", ["-c", escapeCommand(command)], {
			cwd: getProjectCwd() || config.cwd || process.cwd(),
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});

		const pid = trackProcess(child, command);

		child.unref();

		return { ok: true, pid, command };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Unified process tool handler.
 * Routes on action: start, wait, kill, log, write, pause, resume, list.
 * @param {z.infer<typeof UnifiedProcessSchema>} input
 * @returns {Promise<{ok: boolean, [key: string]: any}>} Tool execution result
 */
export async function unifiedProcessImpl(input) {
	const { action } = input;

	// Start action: launch a new command
	if (action === "start") {
		if (!input.command) {
			return { ok: false, error: "Error: command is required for 'start' action" };
		}

		const MAX_COMMAND_LENGTH = 4096;
		if (input.command.length > MAX_COMMAND_LENGTH) {
			return {
				ok: false,
				error: `Error: Command length (${input.command.length} chars) exceeds maximum (${MAX_COMMAND_LENGTH} chars).`,
			};
		}

		if (input.background) {
			return executeBackground(input.command);
		}
		return executeForeground(input.command);
	}

	// List action: show all tracked processes
	if (action === "list") {
		const entries = [];
		for (const [, entry] of processTracker) {
			entries.push({
				pid: entry.pid,
				command: entry.command,
				status: entry.status,
				uptime: `${Math.round((Date.now() - entry.startTime) / 1000)}s`,
			});
		}
		return { ok: true, entries };
	}

	// All other actions require a processId
	const pid = input.processId;
	if (pid === undefined || pid === null) {
		return { ok: false, error: "Error: processId is required for this action" };
	}

	// Validate action
	const validActions = ["log", "wait", "kill", "write", "pause", "resume"];
	if (!validActions.includes(action)) {
		return {
			ok: false,
			error: `Error: Unknown action '${action}'. Supported: list, start, ${validActions.join(", ")}`,
		};
	}

	const entry = processTracker.get(pid);
	if (!entry) {
		return { ok: false, error: `Error: Process ${pid} not found` };
	}

	switch (action) {
		case "log":
			return { ok: true, stdout: entry.stdout, stderr: entry.stderr };
		case "wait":
			return new Promise((resolve) => {
				const checkInterval = setInterval(() => {
					if (entry.status !== "running") {
						clearInterval(checkInterval);
						resolve({ ok: true, stdout: entry.stdout, stderr: entry.stderr });
					}
				}, 200);

				// Timeout after 60 seconds
				setTimeout(() => {
					clearInterval(checkInterval);
					if (entry.status === "running") {
						resolve({ ok: false, error: `Process ${pid} still running after timeout.` });
					}
				}, 60000);
			});
		case "kill":
			try {
				entry.child.kill("SIGTERM");
				setTimeout(() => {
					if (entry.child.exitCode === null) {
						try {
							entry.child.kill("SIGKILL");
						} catch (err) {
							logger.debug(`[process] Error: ${err.message}`);
						}
					}
				}, 5000);
				entry.status = "killing";
				return {
					ok: true,
					message: `Sent SIGTERM to process ${pid}. Will force kill if unresponsive.`,
				};
			} catch (err) {
				processTracker.delete(pid);
				return { ok: false, error: `Error killing process ${pid}: ${err.message}` };
			}
		case "write":
			try {
				entry.child.stdin?.write(input.data || "");
				return { ok: true, message: `Wrote to stdin of process ${pid}` };
			} catch (err) {
				return { ok: false, error: `Error writing to process ${pid}: ${err.message}` };
			}
		case "pause":
			try {
				entry.child.kill("SIGSTOP");
				entry.status = "paused";
				return { ok: true, message: `Paused process ${pid}` };
			} catch (err) {
				return { ok: false, error: `Error pausing process ${pid}: ${err.message}` };
			}
		case "resume":
			try {
				entry.child.kill("SIGCONT");
				entry.status = "running";
				return { ok: true, message: `Resumed process ${pid}` };
			} catch (err) {
				return { ok: false, error: `Error resuming process ${pid}: ${err.message}` };
			}
	}
}

/**
 * Unified process tool for shell commands and background process management.
 * Merges the former shell and process tools into a single interface with an action parameter.
 */
export const processTool = tool(unifiedProcessImpl, {
	name: "process",
	description:
		"Execute shell commands and manage background processes. Actions: start (launch command), list (show all), log (read stdout/stderr), wait (wait for exit), kill (SIGTERM/SIGKILL), write (send stdin data), pause (SIGSTOP), resume (SIGCONT).",
	schema: z.object({
		action: z
			.enum(["start", "list", "log", "wait", "kill", "write", "pause", "resume"])
			.default("start")
			.describe("Action to perform on the process"),
		command: z
			.string()
			.optional()
			.describe("Shell command to execute (required for 'start' action)"),
		background: z.boolean().optional().describe("Run in background mode (only for 'start' action)"),
		processId: z
			.number()
			.int()
			.optional()
			.describe(
				"PID of the process to manage (required for all actions except 'start' and 'list')",
			),
		data: z
			.string()
			.optional()
			.describe("Data to write to process stdin (required for 'write' action)"),
	}),
});
