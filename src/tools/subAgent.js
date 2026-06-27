import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createWriteStream } from "node:fs";
import { trackProcess } from "./terminal.js";
import { loadConfig } from "../config/loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultCwd = loadConfig().cwd;

const SUBAGENT_MARKER = "# SubAgent";

/**
 * Split stdout on the subAgent marker and return the content after it.
 * @param {string} stdout - Raw stdout from the spawned process
 * @returns {{ ok: boolean, result: string, error?: string }}
 */
export function parseSubAgentOutput(stdout) {
	if (!stdout || typeof stdout !== "string") {
		return {
			ok: false,
			result: "",
			error: "No output received from sub-agent process",
		};
	}

	const parts = stdout.split(SUBAGENT_MARKER);
	if (parts.length < 2) {
		return {
			ok: false,
			result: "",
			error: `SubAgent marker "${SUBAGENT_MARKER}" not found in output`,
		};
	}

	const result = parts[1].trim();

	if (!result) {
		return {
			ok: false,
			result: "",
			error: `SubAgent marker found but no result content after it`,
		};
	}

	return {
		ok: true,
		result: `${SUBAGENT_MARKER}\n\n${result}`,
	};
}

/**
 * Filter a JSON result to only include specified keys.
 * @param {string} jsonStr - JSON string to filter
 * @param {string[]} params - Keys to include
 * @returns {{ ok: boolean, result: string, error?: string }}
 */
function filterParams(jsonStr, params) {
	try {
		const parsed = JSON.parse(jsonStr);
		const filtered = {};
		for (const key of params) {
			if (key in parsed) {
				filtered[key] = parsed[key];
			}
		}
		return {
			ok: true,
			result: JSON.stringify(filtered, null, 2),
		};
	} catch {
		return {
			ok: false,
			result: "",
			error: `Failed to parse JSON for parameter filtering: ${jsonStr.substring(0, 100)}`,
		};
	}
}

/**
 * Generate a unique session ID for sub-agent correlation.
 * @returns {string} UUID v4 string
 */
export function generateSessionId() {
	return randomUUID();
}

/**
 * Convert milliseconds to seconds (rounded up).
 * @param {number} ms - Timeout in milliseconds
 * @returns {number} Timeout in seconds
 */
function msToSeconds(ms) {
	return Math.ceil(ms / 1000);
}

/**
 * Spawn a single sub-agent process using system timeout command.
 * @param {string} prompt - The full prompt (context ||| delegation)
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} targetCwd - Working directory for the sub-agent
 * @returns {Promise<{ ok: boolean, result: string, error?: string, sessionId?: string }>}
 */
export function spawnSubAgentProcess(prompt, timeout, targetCwd = defaultCwd) {
	return new Promise((resolve) => {
		const sessionId = generateSessionId();
		const timeoutSeconds = msToSeconds(timeout);

		// Use system timeout command for reliable process termination
		// timeout sends SIGTERM first, then SIGKILL after --kill-after delay
		const child = spawn(
			"timeout",
			[
				"--kill-after=10",
				timeoutSeconds.toString(),
				"node",
				"index.js",
				`--cwd=${targetCwd}`,
				`"${prompt}"`,
			],
			{
				stdio: ["pipe", "pipe", "pipe"],
				env: process.env,
			},
		);

		const logPath = `/tmp/sub-agent-${sessionId}.log`;
		const logStream = createWriteStream(logPath, { flags: "a" });

		trackProcess(child, `subAgent: ${prompt.substring(0, 50)}`, sessionId);

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			const text = data.toString();
			stdout += text;
			logStream.write(text);
		});

		child.stderr.on("data", (data) => {
			const text = data.toString();
			stderr += text;
			logStream.write(text);
		});

		child.on("exit", (code) => {
			logStream.end();

			// Exit code 124 indicates timeout from system timeout command
			if (code === 124) {
				resolve({
					ok: false,
					result: "",
					error: `Sub-agent timed out after ${timeout}ms`,
					sessionId,
				});
				return;
			}

			const parsed = parseSubAgentOutput(stdout);
			if (!parsed.ok) {
				parsed.error = `${parsed.error}${stderr ? ` | stderr: ${stderr.trim()}` : ""}`;
			}
			resolve({ ...parsed, sessionId });
		});

		child.on("error", (err) => {
			logStream.end();
			resolve({
				ok: false,
				result: "",
				error: `Process spawn error: ${err.message}`,
				sessionId,
			});
		});
	});
}

/**
 * Execute fan-out tasks with the specified strategy.
 * @param {Array<{ delegation: string, context: string, id?: string }>} tasks - Tasks to execute
 * @param {"parallel" | "sequential"} strategy - Execution strategy
 * @param {number} maxConcurrent - Maximum concurrent processes
 * @param {"continue" | "fail-fast"} onError - Error handling strategy
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} targetCwd - Working directory for the sub-agent
 * @returns {Promise<{ ok: boolean, result: string, error?: string }>}
 */
async function executeFanOut(tasks, strategy, maxConcurrent, onError, timeout, targetCwd) {
	const results = [];
	let failed = false;

	if (strategy === "sequential") {
		for (const task of tasks) {
			if (failed && onError === "fail-fast") break;

			const prompt = task.context ? `${task.context}\n\n${task.delegation}` : task.delegation;
			const result = await spawnSubAgentProcess(prompt, timeout, targetCwd);

			if (task.id) {
				results.push({ id: task.id, ...result });
			} else {
				results.push(result);
			}

			if (!result.ok && onError === "fail-fast") {
				failed = true;
			}
		}
	} else {
		// Parallel mode with maxConcurrent semaphore
		const queue = [...tasks];
		const active = new Set();
		const promises = [];

		const runNext = () => {
			while (active.size < maxConcurrent && queue.length > 0) {
				const task = queue.shift();
				const promise = (async () => {
					const prompt = task.context ? `${task.context}\n\n${task.delegation}` : task.delegation;
					const result = await spawnSubAgentProcess(prompt, timeout, targetCwd);

					if (task.id) {
						results.push({ id: task.id, ...result });
					} else {
						results.push(result);
					}

					active.delete(promise);
					if (!result.ok && onError === "fail-fast") {
						failed = true;
					}
				})();
				active.add(promise);
				promises.push(promise);
			}
		};

		runNext();
		await Promise.all(promises);
	}

	if (failed && onError === "fail-fast") {
		return {
			ok: false,
			result: JSON.stringify(results.filter((r) => r.ok)),
			error: "Fan-out failed fast",
		};
	}

	return {
		ok: true,
		result: JSON.stringify(results, null, 2),
	};
}

/**
 * Resolve timeout with priority: per-call > config default.
 * @param {number | undefined} perCallTimeout - Per-call timeout parameter
 * @param {object} config - Resolved config object
 * @returns {number} Resolved timeout in milliseconds
 */
function resolveTimeout(perCallTimeout, config) {
	if (perCallTimeout !== undefined && perCallTimeout !== null) {
		return perCallTimeout;
	}

	const configTimeout = config?.process?.subAgent?.timeout;
	if (configTimeout !== undefined && configTimeout !== null) {
		return configTimeout;
	}

	return 600000; // Default 10 minutes
}

/**
 * Create a subAgent tool with runtime options.
 * @param {object} options - Runtime options
 * @param {object} [options.config] - Resolved config object
 * @returns {object} LangChain Tool instance
 */
export function createSubAgentTool(options = {}) {
	const { config } = options;

	return tool(
		async (input) => {
			try {
				const {
					delegation,
					context,
					tasks,
					strategy,
					maxConcurrent,
					onError,
					returnParams,
					timeout,
					cwd: targetCwd = defaultCwd,
				} = input;

				// Resolve timeout
				const resolvedTimeout = resolveTimeout(timeout, config);

				// Fan-out mode
				if (tasks && Array.isArray(tasks) && tasks.length > 0) {
					const fanOutStrategy =
						strategy || config?.process?.subAgent?.defaultStrategy || "parallel";
					const fanOutMaxConcurrent =
						maxConcurrent || config?.process?.subAgent?.maxConcurrent || 4;
					const fanOutOnError = onError || config?.process?.subAgent?.defaultOnError || "continue";

					const result = await executeFanOut(
						tasks,
						fanOutStrategy,
						fanOutMaxConcurrent,
						fanOutOnError,
						resolvedTimeout,
						targetCwd,
					);

					// Apply returnParams filtering if specified
					if (returnParams && returnParams.length > 0 && result.ok) {
						const filtered = filterParams(result.result, returnParams);
						if (filtered.ok) {
							return JSON.stringify({ ok: true, result: filtered.result });
						}
					}

					return JSON.stringify(result);
				}

				// Single execution mode
				if (!delegation) {
					return JSON.stringify({
						ok: false,
						result: "",
						error: "Delegation instruction is required",
					});
				}

				const prompt = context ? `${context}\n\n${delegation}` : delegation;
				const result = await spawnSubAgentProcess(prompt, resolvedTimeout, targetCwd);

				// Apply returnParams filtering if specified
				if (returnParams && returnParams.length > 0 && result.ok) {
					const filtered = filterParams(result.result, returnParams);
					if (filtered.ok) {
						return JSON.stringify({ ok: true, result: filtered.result });
					}
					// If filtering fails, fall back to full text
					return JSON.stringify({ ok: true, result: result.result });
				}

				return JSON.stringify(result);
			} catch (err) {
				return JSON.stringify({
					ok: false,
					result: "",
					error: `SubAgent error: ${err.message}`,
				});
			}
		},
		{
			name: "subAgent",
			description:
				"Spawn child-process agents to execute prompts as independent sub-agents. Supports single execution and fan-out (parallel/sequential) modes with configurable concurrency, timeout, and error handling. Each sub-agent receives a prompt constructed from context and delegation instruction separated by ' ||| '. Returns structured JSON result with ok, result, and optional error fields.",
			schema: z.object({
				cwd: z
					.string()
					.describe(
						"Working directory for the sub-agent process. All file operations and relative paths will be resolved from this directory.",
					),
				delegation: z
					.string()
					.optional()
					.describe(
						"The delegation instruction — what the sub-agent should do. Required for single execution mode. Use 'run <skill-name>' for skill delegation or natural language for instruction delegation.",
					),
				context: z
					.string()
					.optional()
					.describe(
						"Session compaction or context the sub-agent needs to understand the task. Everything before ' ||| ' in the prompt.",
					),
				tasks: z
					.array(
						z.object({
							delegation: z.string().describe("The delegation instruction for this task"),
							context: z.string().describe("Context for this task"),
							id: z.string().optional().describe("Optional task identifier"),
						}),
					)
					.optional()
					.describe(
						"Fan-out mode: array of tasks to execute. When provided, runs in fan-out mode instead of single execution.",
					),
				strategy: z
					.enum(["parallel", "sequential"])
					.optional()
					.describe(
						"Fan-out strategy: 'parallel' runs tasks simultaneously (bounded by maxConcurrent), 'sequential' runs one at a time.",
					),
				maxConcurrent: z
					.number()
					.int()
					.positive()
					.optional()
					.describe(
						"Maximum number of sub-agents that can run in parallel. Overrides config default.",
					),
				onError: z
					.enum(["continue", "fail-fast"])
					.optional()
					.describe(
						"Error handling for fan-out: 'continue' runs remaining tasks if one fails, 'fail-fast' stops on first failure.",
					),
				returnParams: z
					.array(z.string())
					.optional()
					.describe(
						"Optional: filter the sub-agent's JSON result to only include these keys. Falls back to full text if output is not valid JSON.",
					),
				timeout: z
					.number()
					.int()
					.positive()
					.optional()
					.describe(
						"Timeout in milliseconds for this sub-agent execution. Overrides config default.",
					),
			}),
		},
	);
}
