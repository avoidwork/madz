import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "../shared/logger.js";

/**
 * Process tracker shared between shell and process tools.
 * Maps process IDs to process entry objects.
 */
export const processTracker = new Map();
let nextPid = 1000;

/**
 * Record a background process in the tracker.
 * @param {import("node:child_process").ChildProcess} child - The child process
 * @param {string} command - The command that was executed
 * @param {string} [sessionId] - Optional session ID for sub-agent correlation
 * @returns {number} The assigned PID
 */
export function trackProcess(child, command, sessionId) {
	const pid = nextPid++;
	processTracker.set(pid, {
		pid,
		child,
		command,
		sessionId,
		status: "running",
		startTime: Date.now(),
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
 * Manage background processes via process tool.
 * @param {z.infer<typeof ProcessSchema>} input
 * @returns {Promise<string>} Process management result
 */
export async function manageProcessImpl(input) {
	const { action } = input;

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
		return JSON.stringify(entries, null, 0);
	}

	const pid = input.processId;
	if (pid === undefined || pid === null) {
		return "Error: processId is required for this action";
	}

	const entry = processTracker.get(pid);
	if (!entry) {
		return `Error: Process ${pid} not found`;
	}

	switch (action) {
		case "poll":
			return `Process ${pid} status: ${entry.status}`;
		case "log":
			return `Process ${pid} log: [stdout/stderr not captured for background processes]`;
		case "wait":
			return `Process ${pid} wait: [waiting for exit]`;
		case "kill":
			try {
				entry.child.kill("SIGTERM");
				setTimeout(() => {
					if (entry.child.exitCode === null) {
						try {
							entry.child.kill("SIGKILL");
						} catch (err) {
							logger.debug(`[shell] Error: ${err.message}`);
						}
					}
				}, 5000);
				entry.status = "killing";
				return `Sent SIGTERM to process ${pid}. Will force kill if unresponsive.`;
			} catch (err) {
				processTracker.delete(pid);
				return `Error killing process ${pid}: ${err.message}`;
			}
		case "write":
			try {
				entry.child.stdin?.write(input.data || "");
				return `Wrote to stdin of process ${pid}`;
			} catch (err) {
				return `Error writing to process ${pid}: ${err.message}`;
			}
		case "pause":
			try {
				entry.child.kill("SIGSTOP");
				entry.status = "paused";
				return `Paused process ${pid}`;
			} catch (err) {
				return `Error pausing process ${pid}: ${err.message}`;
			}
		case "resume":
			try {
				entry.child.kill("SIGCONT");
				entry.status = "running";
				return `Resumed process ${pid}`;
			} catch (err) {
				return `Error resuming process ${pid}: ${err.message}`;
			}
		default:
			return `Error: Unknown action '${input.action}'. Supported: list, poll, log, wait, kill, write, pause, resume`;
	}
}

/**
 * Process management tool for background process control.
 */
export const processTool = tool(manageProcessImpl, {
	name: "process",
	description:
		"Manage background processes. Actions: list (show all), poll (check status), log (stdout), wait (wait for exit), kill (SIGTERM/SIGKILL), write (send stdin data), pause (SIGSTOP), resume (SIGCONT).",
	schema: z.object({
		action: z
			.enum(["list", "poll", "log", "wait", "kill", "write", "pause", "resume"])
			.describe("Action to perform on the process"),
		processId: z
			.number()
			.int()
			.optional()
			.describe("PID of the process to manage (required for all actions except 'list')"),
		data: z
			.string()
			.optional()
			.describe("Data to write to process stdin (required for 'write' action)"),
	}),
});
