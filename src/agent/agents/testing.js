/**
 * Testing agent definition for test generation and gap analysis.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the testing agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadTestingPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "TESTING.md"), "utf-8");
	} catch {
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
	systemPrompt: loadTestingPrompt(),
};
