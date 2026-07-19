/**
 * Research agent definition for multi-step research.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the research agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadResearchPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "RESEARCH.md"), "utf-8");
	} catch {
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
	systemPrompt: loadResearchPrompt(),
};
