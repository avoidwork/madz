import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the system prompt from prompts/SYSTEM_PROMPT.md.
 * @param {string} [baseDir=process.cwd()] - Base directory for loading the prompt file
 * @returns {string} System prompt text, or empty string if file not found
 */
export function loadSystemPrompt(baseDir = process.cwd()) {
	try {
		const path = join(baseDir, "prompts", "SYSTEM_PROMPT.md");
		const content = readFileSync(path, "utf-8");
		if (content.startsWith("---")) {
			const closeIdx = content.indexOf("---", 3);
			if (closeIdx !== -1) {
				return content.substring(closeIdx + 3).replace(/^\n+/, "");
			}
		}
		return content;
	} catch {
		return "";
	}
}
