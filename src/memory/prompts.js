import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";
import { loadContext } from "./context.js";

const cwd = loadConfig().cwd;

/**
 * Load the system prompt from prompts/SYSTEM_PROMPT.md or prompts/SUB_AGENT.md,
 * appending the current memory context to the end.
 * @param {string} [baseDir=cwd] - Base directory for loading the prompt file
 * @param {boolean} [subAgent=false] - Whether running as a sub-agent
 * @returns {string} System prompt text with appended context, or empty string if file not found
 */
export function loadSystemPrompt(baseDir = cwd, subAgent = false) {
	try {
		const filename = subAgent ? "SUB_AGENT.md" : "SYSTEM_PROMPT.md";
		const path = join(baseDir, "prompts", filename);
		let content = readFileSync(path, "utf-8");
		if (content.startsWith("---")) {
			const closeIdx = content.indexOf("---", 3);
			if (closeIdx !== -1) {
				content = content.substring(closeIdx + 3).replace(/^\n+/, "");
			}
		}
		// Append memory context to the system prompt
		const context = loadContext();
		if (context) {
			content = content + "\n\n---\n\n" + context;
		}
		return content;
	} catch {
		return "";
	}
}
