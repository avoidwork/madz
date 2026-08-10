import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { trackProcess } from "./process.js";

const MAX_COMMAND_LENGTH = 4096;

/**
 * Execute a command in foreground mode.
 */
function executeForeground(command) {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let exitCode = -1;

		const child = spawn("sh", ["-c", command], {
			cwd: process.cwd(),
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
			resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode, running: false });
		});

		child.on("error", (err) => {
			resolve({ stdout, stderr, exitCode: -1, running: false, error: err.message });
		});
	}).then((result) =>
		result.stderr
			? `exitCode: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
			: result.error
				? `Error: ${result.error}`
				: `exitCode: ${result.exitCode}\nstdout: ${result.stdout}`,
	);
}

/**
 * Execute a command in background mode.
 */
function executeBackground(command) {
	try {
		const child = spawn("sh", ["-c", command], {
			cwd: process.cwd(),
			detached: true,
			stdio: ["ignore", "ignore", "ignore"],
		});

		const pid = trackProcess(child, command);

		// Unref so it doesn't keep the Node.js process alive
		child.unref();

		return `Started process in background: ${command} (PID: ${pid})`;
	} catch (err) {
		return `Error starting background process: ${err.message}`;
	}
}

/**
 * Execute a shell command via shell tool.
 * @param {z.infer<typeof TerminalSchema>} input
 * @returns {Promise<string>} Command execution result
 */
export async function executeShellImpl(input) {
	if (input.command.length > MAX_COMMAND_LENGTH) {
		return `Error: Command length (${input.command.length} chars) exceeds maximum (${MAX_COMMAND_LENGTH} chars).`;
	}

	const config = loadConfig();
	const sandbox = config.sandbox || {};
	const allowedPaths = sandbox.paths || [];
	const maxReadSize = sandbox.maxReadSize || "1mb";

	if (input.background) {
		return executeBackground(input.command, allowedPaths);
	}
	return executeForeground(input.command, allowedPaths, maxReadSize);
}

/**
 * Shell tool for executing shell commands.
 */
export const shell = tool(executeShellImpl, {
	name: "shell",
	description:
		"Execute a shell command via sh -c. Supports foreground (blocking) and background (detached) modes. Max command length is 4096 characters.",
	schema: z.object({
		command: z.string().describe("Shell command to execute via sh -c"),
		background: z
			.boolean()
			.default(false)
			.describe("Run in background mode (returns immediately with PID)"),
	}),
});
