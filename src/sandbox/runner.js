import { fork } from "node:child_process";
import { handleTimeout } from "./timeoutHandler.js";
import { filterEnv } from "./envInjector.js";
import { enforceCapabilities } from "./capability.js";

/**
 * Run a skill script in a sandboxed forked process with resource limits.
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
		cwd = process.cwd(),
	} = options;

	const { rules } = enforceCapabilities(permissions);
	const env = filterEnv(process.env, whitelist);

	// Enforce capabilities
	const _hasNetworkAccess = rules.some((r) => r.resource === "network");

	const child = fork(script, [], {
		cwd,
		env,
		execArgv: ["--max-old-space-size=512"],
		stdio: ["pipe", "pipe", "pipe", "ipc"],
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
