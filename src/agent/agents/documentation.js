/**
 * Documentation agent definition for documentation updates.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the documentation agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadDocumentationPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "DOCUMENTATION.md"), "utf-8");
	} catch (err) {
		logger.debug(`[documentation] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Documentation agent definition.
 * @type {Object}
 */
export const documentationAgent = {
	name: "documentation",
	description:
		"Specialized agent for documentation updates, API docs generation, and changelog maintenance.",
	systemPrompt: "",
};

loadDocumentationPrompt().then((prompt) => {
	documentationAgent.systemPrompt = prompt;
});
