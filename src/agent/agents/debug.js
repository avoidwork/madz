/**
 * Debug agent definition for error tracing and fix proposals.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the debug agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadDebugPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "DEBUG.md"), "utf-8");
	} catch {
		return "";
	}
}

/**
 * Debug agent definition.
 * @type {Object}
 */
export const debugAgent = {
	name: "debug",
	description:
		"Specialized agent for error tracing, reproduction, and fix proposals with dedicated context.",
	systemPrompt: loadDebugPrompt(),
};
