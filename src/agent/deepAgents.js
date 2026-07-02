import { createDeepAgent, CompositeBackend, createSubAgent, createFilesystemMiddleware, createMemoryMiddleware } from "deepagents";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { createCoreBackend } from "./coreBackend.js";
import { createContextBackend } from "./contextBackend.js";
import { createSubAgentsBackend } from "./subAgentsBackend.js";

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
	const coreBackend = createCoreBackend();
	const contextBackend = createContextBackend();
	const subAgentsBackend = createSubAgentsBackend();

	const codingSubAgent = createSubAgent({
		name: "coding-agent",
		description:
			"Specialized agent for code-related tasks including file editing, debugging, implementation, and code review.",
		systemPrompt: codeAgentPrompt || "You are a coding specialist. Handle all code-related tasks.",
		model,
		tools,
		middleware: [
			createFilesystemMiddleware({ backend: coreBackend }),
			createMemoryMiddleware({ backend: subAgentsBackend }),
		],
	});

	return createDeepAgent({
		model,
		tools,
		systemPrompt,
		store: new InMemoryStore(),
		backend: new CompositeBackend(coreBackend, {
			"/memory/context/": contextBackend,
		}),
		subagents: [codingSubAgent],
		...(checkpointer && { checkpointer }),
	});
}
