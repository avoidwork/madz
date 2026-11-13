import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadContext } from "./context.js";
import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

// Token replaced in SYSTEM_PROMPT.md when the decision tool is enabled.
const DECISION_TOOL_TOKEN = "<!-- DECISION_TOOL_INSTRUCTION -->";

// Instruction block injected when agent.decision.baseUrl is set. Standalone and
// unnumbered so disabling the tool leaves no gap in any numbered list.
const DECISION_TOOL_INSTRUCTION =
	"**Decision tool:** A `decision` tool is available for fast, structured classification (routing, policy checks, rubric scoring). It accepts a `state` and a `questions` record, where each question has a `type` (`choice`, `noul`, or `score`), `instructions`, and optional `criteria`. Use it when you need a quick, deterministic judgment from a dedicated decision model rather than reasoning it out yourself.";

// Token replaced in SYSTEM_PROMPT.md when the sampling tool is enabled.
const SAMPLING_TOOL_TOKEN = "<!-- SAMPLING_TOOL_INSTRUCTION -->";

// Instruction block injected when agent.sampling is enabled. Standalone and
// unnumbered so disabling the tool leaves no gap in any numbered list.
const SAMPLING_TOOL_INSTRUCTION =
	"**Sampling:** The **sampling** tool captures meaningful moments as ephemeral memories. Briefly tell the user when you capture a memory (one short sentence), and mention that they can ask to see or delete their memories at any time. Invoke it when: (a) the user expresses satisfaction after a complex task, (b) a pattern emerges across sessions, (c) the user shares something personal or emotionally significant, (d) a technical breakthrough occurs.";

// Open-ended header appended to the end of the authored prompt. deepagents
// middleware (skills, filesystem, memory, subagents) augments the system prompt
// at model-call time via raw string concatenation (`SystemMessage.concat`), so
// this header gives that injected content a clean landing spot instead of
// blending into the authored content.
const RUNTIME_HEADER = "### RUNTIME CAPABILITIES";

/**
 * Load the system prompt from prompts/SYSTEM_PROMPT.md,
 * appending the current memory context to the end.
 * @param {string} [baseDir] - Base directory for the prompt file and memory (defaults to config cwd)
 * @returns {Promise<string>} System prompt text with appended context
 * @throws {Error} When SYSTEM_PROMPT.md cannot be read (logged at error level)
 */
export async function loadSystemPrompt(baseDir) {
	const config = loadConfig();
	const root = baseDir ?? config.cwd;
	const path = join(root, "prompts", "SYSTEM_PROMPT.md");
	try {
		let content = await readFile(path, "utf-8");
		content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").replace(/^(\r?\n)+/, "");
		// Inject the decision tool instruction when the tool is enabled, or
		// remove the token entirely when it is disabled.
		const baseUrl = config?.agent?.decision?.baseUrl;
		const decisionReplacement = baseUrl ? DECISION_TOOL_INSTRUCTION : "";
		content = content.replaceAll(DECISION_TOOL_TOKEN, decisionReplacement);
		// Inject the sampling tool instruction when the tool is enabled, or
		// remove the token entirely when it is disabled.
		const samplingEnabled = config?.agent?.sampling !== false;
		const samplingReplacement = samplingEnabled ? SAMPLING_TOOL_INSTRUCTION : "";
		content = content.replaceAll(SAMPLING_TOOL_TOKEN, samplingReplacement);
		// Append memory context to the system prompt. The context is already
		// structured with `###` section headers, so no separator is needed.
		const context = await loadContext(config.memory.contextDir, undefined, root);
		if (context) {
			content = content + "\n\n" + context;
		}
		// End the authored prompt with an open-ended header so runtime
		// augmentations (skills, filesystem, memory, subagents) concat cleanly
		// beneath it rather than blending into the authored content.
		return content + "\n\n" + RUNTIME_HEADER;
	} catch (err) {
		logger.error(`[prompts] Failed to load system prompt ${path}: ${err.message}`);
		throw err;
	}
}
