import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Load the system prompt from prompts/SYSTEM_PROMPT.md.
 * Replaces [PROCESS_IDENTITY] placeholder with the appropriate process identity.
 * @param {string} [baseDir=cwd] - Base directory for loading the prompt file
 * @param {boolean} [subAgent=false] - Whether running as a sub-agent
 * @returns {string} System prompt text, or empty string if file not found
 */
export function loadSystemPrompt(baseDir = cwd, subAgent = false) {
	try {
		const path = join(baseDir, "prompts", "SYSTEM_PROMPT.md");
		let content = readFileSync(path, "utf-8");
		if (content.startsWith("---")) {
			const closeIdx = content.indexOf("---", 3);
			if (closeIdx !== -1) {
				content = content.substring(closeIdx + 3).replace(/^\n+/, "");
			}
		}
		const processIdentity = subAgent
			? "Sub-agent executor. Read the `SKILL.md` and execute directly. Do NOT delegate further."
			: "Main orchestrator. Delegate skill execution to sub-agents. Do NOT read `SKILL.md` files — sub-agents read them on activation.";
		return content.replace(/\[PROCESS_IDENTITY\]/g, processIdentity);
	} catch {
		return "";
	}
}
