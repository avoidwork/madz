/**
 * Search agent definition for multi-source search and synthesis.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the search agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadSearchPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "SEARCH.md"), "utf-8");
	} catch {
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
	systemPrompt: loadSearchPrompt(),
};
