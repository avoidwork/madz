/**
 * Code review agent definition for structured code reviews.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the code review agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadCodeReviewPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "CODE_REVIEW.md"), "utf-8");
	} catch (err) {
		logger.debug(`[code-review] Failed to load prompt: ${err.message}`);
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
	systemPrompt: "",
};

loadCodeReviewPrompt().then((prompt) => {
	codeReviewAgent.systemPrompt = prompt;
});
