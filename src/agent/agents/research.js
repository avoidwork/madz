/**
 * Research agent definition for multi-step research.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the research agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadResearchPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "RESEARCH.md"), "utf-8");
	} catch (err) {
		logger.debug(`[research] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Research agent definition.
 * @type {Object}
 */
export const researchAgent = {
	name: "research",
	description:
		"Specialized agent for multi-step research with source tracking and comprehensive reports.",
	systemPrompt: "",
};

loadResearchPrompt().then((prompt) => {
	researchAgent.systemPrompt = prompt;
});
