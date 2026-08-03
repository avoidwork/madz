/**
 * Testing agent definition for test generation and gap analysis.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the testing agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadTestingPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "TESTING.md"), "utf-8");
	} catch (err) {
		logger.debug(`[testing] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Testing agent definition.
 * @type {Object}
 */
export const testingAgent = {
	name: "testing",
	description: "Specialized agent for test generation, gap analysis, and coverage improvements.",
	systemPrompt: "",
};

loadTestingPrompt().then((prompt) => {
	testingAgent.systemPrompt = prompt;
});
