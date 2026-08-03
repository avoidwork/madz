/**
 * Search agent definition for multi-source search and synthesis.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the search agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadSearchPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "SEARCH.md"), "utf-8");
	} catch (err) {
		logger.debug(`[search] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Search agent definition.
 * @type {Object}
 */
export const searchAgent = {
	name: "search",
	description:
		"Specialized agent for multi-source search (web, docs, codebase) with synthesis into structured summaries.",
	systemPrompt: "",
};

loadSearchPrompt().then((prompt) => {
	searchAgent.systemPrompt = prompt;
});
