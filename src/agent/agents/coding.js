/**
 * Coding agent definition for code execution and editing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the coding agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadCodingPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "CODING.md"), "utf-8");
	} catch {
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
	systemPrompt: loadCodingPrompt(),
};
