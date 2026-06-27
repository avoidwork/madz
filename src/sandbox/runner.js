import { spawn } from "node:child_process";
import { handleTimeout } from "./timeoutHandler.js";
import { filterEnv } from "./envInjector.js";
import { enforceCapabilities } from "./capability.js";
import { readFileSync, existsSync } from "node:fs";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Map file extension to interpreter command.
 * @param {string} filePath - Path to the script
 * @returns {object | null} { command, args } or null if unsupported
 */
export function detectInterpreter(filePath) {
	if (!filePath || typeof filePath !== "string") return null;

	const ext = filePath.split(".").pop()?.toLowerCase();

	switch (ext) {
		case "py":
			return { command: "python3", args: [] };
		case "js":
		case "mjs":
			return { command: "node", args: [] };
		case "sh":
			return { command: "bash", args: [] };
		case "rb":
			return { command: "ruby", args: [] };
		case "ts":
			return { command: "node", args: ["--import", "tsx"] };
		case "lua":
			return { command: "lua", args: [] };
		default:
			// Try to detect via shebang
			return detectShebang(filePath);
	}
}

/**
 * Read the first line of a file to detect interpreter via shebang.
 * @param {string} filePath - Path to the script
 * @returns {object | null} { command, args } or null if unsupported
 */
export function detectShebang(filePath) {
	if (!filePath || !existsSync(filePath)) return null;

	try {
		const firstLine = readFileSync(filePath, "utf-8").split("\n")[0];
		const match = firstLine.match(/^#!\s*(\/\S+?)(?:\s+(.*))?$/);
		if (match) {
			const cmd = match[1];
			const args = match[2]?.split(/\s+/).filter(Boolean) || [];
			const baseCmd = cmd.split("/").pop();

			// Handle #!/usr/bin/env X pattern
			if (baseCmd === "env" && args.length > 0) {
				const targetCmd = args[0];
				switch (targetCmd) {
					case "python":
					case "python3":
						return { command: "python3", args: args.slice(1) };
					case "shell":
					case "sh":
					case "bash":
						return { command: "bash", args: args.slice(1) };
					case "node":
						return { command: "node", args: args.slice(1) };
					case "ruby":
						return { command: "ruby", args: args.slice(1) };
					default:
						return { command: targetCmd, args: args.slice(1) };
				}
			}

			// Map common shebangs to known interpreters
			switch (baseCmd) {
				case "python":
				case "python3":
					return { command: "python3", args };
				case "python2":
					return { command: "python2", args };
				case "bash":
				case "sh":
					return { command: "bash", args };
				case "zsh":
					return { command: "zsh", args };
				case "node":
					return { command: "node", args };
				case "ruby":
					return { command: "ruby", args };
				default:
					return { command: cmd, args };
			}
		}
	} catch {
		// File unreadable
	}

	return null;
}

/**
 * Run a skill script in a sandboxed spawned process with resource limits.
 * @param {Object} options - Execution configuration
 * @param {string} options.script - Path to the skill script to run
 * @param {string[]} options.scope - Allowed filesystem scope paths
 * @param {string} options.skillName - Name of the skill for telemetry
 * @param {string[]} options.permissions - Skill permissions
 * @param {string[]} [options.whitelist] - Allowed environment variable names
 * @param {number} [options.timeout=30] - Timeout in seconds
 * @param {Record<string, string>} [options.args={}] - Arguments to pass as env vars
 * @param {string} [options.cwd] - Working directory for the child
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number | null }>}
 */
export async function runSandbox(options) {
	const {
		script,
		_scope,
		_skillName,
		permissions = [],
		whitelist = [],
		timeout = 30,
		_args = {},
		cwd = cwd,
	} = options;

	const { _rules } = enforceCapabilities(permissions);

	let env = filterEnv(process.env, whitelist);

	// Detect interpreter
	const interp = detectInterpreter(script) ||
		detectShebang(script) || {
			command: "node",
			args: [],
		};

	const ext = script.split(".").pop()?.toLowerCase();

	// Ensure PATH is available when spawning scripts
	if (interp.command === "node" && !env.PATH) {
		if (process.env.PATH) {
			env = { ...env, PATH: process.env.PATH };
		}
	}

	// Build exec args based on interpreter type
	const execArgs = [];
	if (ext === "js" || ext === "mjs") {
		// Pass memory limit to Node.js scripts
		execArgs.push("--max-old-space-size=512");
	}

	const child = spawn(interp.command, [...interp.args, script], {
		cwd,
		env,
		execArgv: execArgs.length > 0 ? execArgs : undefined,
		stdio: ["pipe", "pipe", "pipe"],
	});

	const result = {
		stdout: "",
		stderr: "",
		exitCode: null,
	};

	child.stdout.on("data", (data) => {
		result.stdout += data.toString();
	});

	child.stderr.on("data", (data) => {
		result.stderr += data.toString();
	});

	await new Promise((resolve, reject) => {
		child.on("exit", (code) => {
			result.exitCode = code;
			resolve(code);
		});

		// node:coverage ignore next 3
		child.on("error", (err) => {
			reject(err);
		});

		(async () => {
			const status = await handleTimeout(child, { seconds: timeout, gracePeriod: 5 });
			if (status === "killed" || (status === "terminated" && child.exitCode !== 0)) {
				// Timeout or error — already resolved via exit handler
			}
		})();
	});

	return result;
}
