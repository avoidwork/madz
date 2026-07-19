/**
 * Performance agent definition for performance benchmarking.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the performance agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadPerformancePrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "PERFORMANCE.md"), "utf-8");
	} catch {
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
	systemPrompt: loadPerformancePrompt(),
};
