import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadContext } from "./context.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

const cwd = loadConfig().cwd;

// Token replaced in SYSTEM_PROMPT.md when the decision tool is enabled.
const DECISION_TOOL_TOKEN = "<!-- DECISION_TOOL_INSTRUCTION -->";

// Instruction block injected when agent.decision.baseUrl is set. Standalone and
// unnumbered so disabling the tool leaves no gap in any numbered list.
const DECISION_TOOL_INSTRUCTION =
	"**Decision tool:** A `decision` tool is available for fast, structured classification (routing, policy checks, rubric scoring). It accepts a `state` and a `questions` record, where each question has a `type` (`choice`, `noul`, or `score`), `instructions`, and optional `criteria`. Use it when you need a quick, deterministic judgment from a local model rather than reasoning it out yourself.";

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
		// Inject the decision tool instruction when the tool is enabled, or
		// remove the token entirely when it is disabled.
		const config = loadConfig();
		const baseUrl = config?.agent?.decision?.baseUrl;
		const replacement = baseUrl ? DECISION_TOOL_INSTRUCTION : "";
		content = content.replaceAll(DECISION_TOOL_TOKEN, replacement);
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
