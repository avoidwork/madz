import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Debug agent definition for error tracing and fix proposals.
 */

/**
 * Load the debug agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadDebugPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "DEBUG.md"), "utf-8");
	} catch (err) {
		logger.debug(`[debug] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Debug agent definition.
 * @type {Object}
 */
export const debugAgent = {
	name: "debug",
	description:
		"Specialized agent for error tracing, reproduction, and fix proposals with dedicated context.",
	systemPrompt: "",
};

loadDebugPrompt().then((prompt) => {
	debugAgent.systemPrompt = prompt;
});
