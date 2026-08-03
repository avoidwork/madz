/**
 * Performance agent definition for performance benchmarking.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the performance agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadPerformancePrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "PERFORMANCE.md"), "utf-8");
	} catch (err) {
		logger.debug(`[performance] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Performance agent definition.
 * @type {Object}
 */
export const performanceAgent = {
	name: "performance",
	description:
		"Specialized agent for performance benchmarking, bottleneck identification, and optimization suggestions.",
	systemPrompt: "",
};

loadPerformancePrompt().then((prompt) => {
	performanceAgent.systemPrompt = prompt;
});
