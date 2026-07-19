/**
 * Documentation agent definition for documentation updates.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the documentation agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadDocumentationPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "DOCUMENTATION.md"), "utf-8");
	} catch {
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
	systemPrompt: loadDocumentationPrompt(),
};
