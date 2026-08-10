import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadContext } from "./context.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

const cwd = loadConfig().cwd;

/**
 * Load the system prompt from prompts/SYSTEM_PROMPT.md,
 * appending the current memory context to the end.
 * @param {string} [baseDir=cwd] - Base directory for loading the prompt file
 * @returns {Promise<string>} System prompt text with appended context, or empty string if file not found
 */
export async function loadSystemPrompt(baseDir = cwd) {
	try {
		const path = join(baseDir, "prompts", "SYSTEM_PROMPT.md");
		let content = await readFile(path, "utf-8");
		if (content.startsWith("---")) {
			const closeIdx = content.indexOf("---", 3);
			if (closeIdx !== -1) {
				content = content.substring(closeIdx + 3).replace(/^\n+/, "");
			}
		}
		// Append memory context to the system prompt
		const context = await loadContext();
		if (context) {
			content = content + "\n\n---\n\n" + context;
		}
		return content;
	} catch (err) {
		logger.debug(`[prompts] Failed to load system prompt: ${err.message}`);
		return "";
	}
}
