/**
 * Code review agent definition for structured code reviews.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the code review agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadCodeReviewPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "CODE_REVIEW.md"), "utf-8");
	} catch {
		return "";
	}
}

/**
 * Code review agent definition.
 * @type {Object}
 */
export const codeReviewAgent = {
	name: "code-review",
	description:
		"Specialized agent for structured code reviews covering bugs, security, style, and performance.",
	systemPrompt: loadCodeReviewPrompt(),
};
