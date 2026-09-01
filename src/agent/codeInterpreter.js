// src/agent/codeInterpreter.js — CodeInterpreterMiddleware for deepagents.

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { QuickJSVM } from "../sandbox/vm.js";
import { signSnapshot, verifySnapshot } from "../sandbox/vm/snapshot.js";
import { logger } from "../shared/logger.js";

/**
 * @typedef {Object} CodeInterpreterConfig
 * @property {boolean} enabled - Whether the middleware is enabled
 * @property {string} mode - Persistence mode: "thread", "turn", or "call"
 * @property {number} memoryLimit - Memory limit in bytes
 * @property {number} timeoutMs - Execution timeout in ms
 * @property {number} maxResultChars - Max result characters
 * @property {boolean} captureConsole - Capture console output
 * @property {boolean} subagentsEnabled - Enable subagent dispatch
 * @property {boolean} ptcEnabled - Enable PTC tool proxy
 * @property {string} toolName - Name of the eval tool
 * @property {string} [snapshotSecret] - HMAC secret for snapshots
 * @property {string[]} [ptcWhitelist] - Whitelisted PTC tool names
 */

/**
 * @typedef {Object} CodeInterpreterMiddleware
 * @property {any} evalTool - LangChain StructuredTool instance
 * @property {Function} [wrapModelCall] - Function to inject system prompt
 */

/**
 * System prompt instructions for the eval tool.
 * @type {string}
 */
const EVAL_SYSTEM_PROMPT = `
### CODE INTERPRETER

You have access to an \`eval\` tool that executes JavaScript code in a sandboxed QuickJS environment.

**When to use \`eval\`:**
- Complex loops or iterations over data
- Parallel execution of independent operations
- Conditional branching based on computed values
- Data transformation and manipulation
- Any task requiring programmatic computation

**How \`eval\` works:**
- Pass JavaScript code as a string to the \`eval\` tool
- The code executes in an isolated sandbox
- Results are returned as strings
- Maximum execution time: 30 seconds (configurable)
- Maximum memory: 512MB (configurable)

**Limitations:**
- No access to the file system
- No access to Node.js APIs
- Network requests are sandboxed (URL filtering may apply)
- Each execution is stateless unless persistence mode is "thread" or "turn"

**Best practices:**
- Keep code concise and focused
- Handle errors gracefully with try/catch
- Use console.log() for debugging (captured if enabled)
- Return meaningful results
`;

/**
 * Create a CodeInterpreterMiddleware instance.
 * Manages VM lifecycle per persistence mode (thread, turn, call).
 * @param {CodeInterpreterConfig} config - Middleware configuration
 * @returns {CodeInterpreterMiddleware} Middleware object with evalTool and wrapModelCall
 */
export function createCodeInterpreterMiddleware(config) {
	const {
		enabled = false,
		mode = "thread",
		memoryLimit = 536870912,
		timeoutMs = 30000,
		maxResultChars = 50000,
		captureConsole = false,
		_subagentsEnabled = false,
		_ptcEnabled = false,
		toolName = "eval",
		snapshotSecret,
		_ptcWhitelist = [],
	} = config;

	// VM state per persistence mode
	/** @type {QuickJSVM | null} */
	let threadVm = null;
	/** @type {QuickJSVM | null} */
	let turnVm = null;

	/**
	 * Get or create a VM based on the current persistence mode.
	 * @returns {Promise<QuickJSVM>} The VM instance
	 */
	async function getVm() {
		if (mode === "call") {
			// Fresh VM per call — create and caller is responsible for disposal
			const vm = new QuickJSVM({
				memoryLimit,
				timeoutMs,
				captureConsole,
			});
			await vm.initialize();
			return vm;
		}

		if (mode === "thread") {
			if (!threadVm) {
				threadVm = new QuickJSVM({
					memoryLimit,
					timeoutMs,
					captureConsole,
				});
				await threadVm.initialize();
			}
			return threadVm;
		}

		// mode === "turn"
		// Need to track turn boundaries — use a simple turn counter
		// Since we don't have turn IDs from the middleware layer,
		// we create a new VM when the previous one is stale
		if (!turnVm) {
			turnVm = new QuickJSVM({
				memoryLimit,
				timeoutMs,
				captureConsole,
			});
			await turnVm.initialize();
		}
		return turnVm;
	}

	/**
	 * Dispose the current VM for the given mode.
	 * @param {string} vmMode - The mode to dispose ("thread", "turn", "call")
	 * @returns {Promise<void>}
	 */
	async function disposeVm(vmMode) {
		let vm;
		if (vmMode === "thread") {
			vm = threadVm;
			threadVm = null;
		} else if (vmMode === "turn") {
			vm = turnVm;
			turnVm = null;
		}
		if (vm) {
			await vm.dispose();
		}
	}

	/**
	 * Build the eval tool schema and handler.
	 * @returns {any} LangChain StructuredTool
	 */
	function buildEvalTool() {
		const schema = z.object({
			code: z.string().describe("JavaScript code to execute"),
		});

		const handler = async (input) => {
			const { code } = input;

			// Truncate code for logging
			const logCode = code.length > 200 ? `${code.slice(0, 200)}...` : code;

			logger.debug({ code: logCode, mode }, "[CodeInterpreter] Executing eval");

			const vm = await getVm();

			try {
				const result = await vm.evaluate(code);

				// Truncate result if too long
				if (result.length > maxResultChars) {
					return `${result.slice(0, maxResultChars)}... [truncated, ${result.length} chars]`;
				}

				return result;
			} catch (err) {
				logger.error({ error: err.message }, "[CodeInterpreter] Eval execution failed");
				return `Error: ${err.message || String(err)}`;
			}
		};

		return tool(handler, {
			name: toolName,
			description:
				"Execute JavaScript code in a sandboxed QuickJS environment. Use for loops, parallel execution, conditional branching, data transformation, and any task requiring programmatic computation.",
			schema,
		});
	}

	/**
	 * Create the wrapModelCall function that injects system prompt.
	 * @param {string} systemPrompt - Original system prompt
	 * @returns {string} Modified system prompt with eval instructions
	 */
	function wrapModelCall(systemPrompt) {
		if (!enabled) {
			return systemPrompt;
		}
		return systemPrompt + EVAL_SYSTEM_PROMPT;
	}

	/**
	 * Get a snapshot of the current VM state.
	 * @returns {Promise<string>} Signed snapshot string
	 */
	async function getSnapshot() {
		let vm;
		if (mode === "thread") {
			vm = threadVm;
		} else if (mode === "turn") {
			vm = turnVm;
		}
		if (!vm) {
			return "";
		}
		const rawSnapshot = await vm.getSnapshot();
		if (!rawSnapshot || !snapshotSecret) {
			return rawSnapshot;
		}
		return signSnapshot(rawSnapshot, snapshotSecret);
	}

	/**
	 * Restore VM state from a snapshot.
	 * @param {string} snapshot - Signed snapshot string
	 * @returns {Promise<boolean>} True if restored successfully
	 */
	async function restoreSnapshot(snapshot) {
		if (!snapshot) {
			return false;
		}

		let rawSnapshot = snapshot;
		if (snapshotSecret) {
			const { valid, snapshot: extracted } = verifySnapshot(snapshot, snapshotSecret);
			if (!valid) {
				logger.warn(
					{ snapshotLength: snapshot.length },
					"[CodeInterpreter] Snapshot verification failed",
				);
				return false;
			}
			rawSnapshot = extracted;
		}

		try {
			const vm = await QuickJSVM.restore(rawSnapshot);
			if (mode === "thread") {
				threadVm = vm;
			} else if (mode === "turn") {
				turnVm = vm;
			}
			logger.info({ mode }, "[CodeInterpreter] Snapshot restored");
			return true;
		} catch (err) {
			logger.error({ error: err.message }, "[CodeInterpreter] Snapshot restore failed");
			return false;
		}
	}

	/**
	 * Dispose all VMs and clean up resources.
	 * @returns {Promise<void>}
	 */
	async function dispose() {
		await disposeVm("thread");
		await disposeVm("turn");
	}

	const evalTool = buildEvalTool();

	return {
		evalTool,
		wrapModelCall,
		getSnapshot,
		restoreSnapshot,
		dispose,
	};
}
