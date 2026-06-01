import { loadContext } from "../memory/context.js";
import { readFileSync, existsSync } from "node:fs";

/**
 * Execute a scheduled skill within the sandbox with inherited memory context.
 * @param {Object} schedule - The parsed schedule entry
 * @param {Object} sandbox - The sandbox runner
 * @param {Object} [sessionState] - Current session state
 * @param {string} [sessionState.contextDir] - Directory for loadContext fallback
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export async function runScheduledSkill(schedule, sandbox, sessionState = {}) {
	const { skill, input, contextFile } = schedule;
	const contextDir = sessionState.contextDir || "memory/context/";

	// Load context file if specified
	let contextPrefix = "";
	if (contextFile && existsSync(contextFile)) {
		contextPrefix = readFileSync(contextFile, "utf-8");
	} else if (contextFile) {
		// Try loading from configured context directory
		contextPrefix = loadContext(contextDir);
	}

	// Run skill through sandbox
	const result = await sandbox({
		skillName: skill,
		input,
		context: contextPrefix,
		permissions: sessionState.skills || [],
	});

	return result;
}
