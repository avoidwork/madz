/**
 * Coding agent definition for code execution and editing.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the coding agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadCodingPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "CODING.md"), "utf-8");
	} catch (err) {
		logger.debug(`[coding] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Coding agent definition.
 * @type {Object}
 */
export const codingAgent = {
	name: "coding",
	description: "Specialized agent for code editing, debugging, testing, and implementation tasks.",
	systemPrompt: "",
};

// Load prompt asynchronously at module initialization
loadCodingPrompt().then((prompt) => {
	codingAgent.systemPrompt = prompt;
});
