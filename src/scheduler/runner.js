import { loadContext } from "../memory/context.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Execute a scheduled skill within the sandbox with inherited memory context.
 * @param {Object} schedule - The parsed schedule entry
 * @param {Object} sandbox - The sandbox runner
 * @param {Object} [sessionState] - Current session state
 * @param {string} [sessionState.contextDir] - Directory for loadContext fallback
 * @param {number} [sessionState.timeoutMs] - Sandbox timeout in milliseconds
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export async function runScheduledSkill(schedule, sandbox, sessionState = {}) {
	const { skill, input, contextFile } = schedule;
	const contextDir = sessionState.contextDir || "memory/context/";
	const timeoutMs = sessionState.timeoutMs || DEFAULT_TIMEOUT_MS;

	// Load context file if specified (non-blocking)
	let contextPrefix = "";
	if (contextFile) {
		try {
			if (existsSync(contextFile)) {
				contextPrefix = await readFile(contextFile, "utf-8");
			} else {
				contextPrefix = loadContext(contextDir);
			}
		} catch {
			// Context load failed — continue with empty context
		}
	}

	// Run skill through sandbox with timeout
	const result = await Promise.race([
		sandbox({
			skillName: skill,
			input,
			context: contextPrefix,
			permissions: sessionState.skills || [],
		}),
		new Promise((_, reject) =>
			setTimeout(
				() => reject(new Error(`Sandbox execution timed out after ${timeoutMs}ms`)),
				timeoutMs,
			),
		),
	]);

	return result;
}
