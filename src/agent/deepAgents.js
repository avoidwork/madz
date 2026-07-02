import { createDeepAgent } from "deepagents";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadCodeAgentPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "CODE_AGENT.md"), "utf-8");
	} catch {
		return "";
	}
}

/**
 * Create a Deep Agents orchestrator with coding and utility sub-agents.
 * Uses deepagents middleware for filesystem, memory, skills, and summarization.
 * @param {object} model - A chat language model instance
 * @param {unknown[]} tools - Array of LangChain tool definitions (non-overlapping tools)
 * @param {string} systemPrompt - The main system prompt
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Object} Deep Agents orchestrator instance
 */
export function createDeepAgentsOrchestrator(
	model,
	tools = [],
	systemPrompt = "",
	checkpointer = null,
) {
	const codeAgentPrompt = loadCodeAgentPrompt();

	return createDeepAgent({
		model,
		systemPrompt,
		tools,
		middleware: [],
		subagents: [
			{
				name: "coding-agent",
				description:
					"Specialized agent for code-related tasks including file editing, debugging, implementation, and code review.",
				systemPrompt: codeAgentPrompt
					? `${codeAgentPrompt}\n\nYou are the coding specialist. Focus on code-related tasks.`
					: "You are a coding specialist. Handle all code-related tasks.",
			},
		],
		...(checkpointer && { checkpointer }),
	});
}
