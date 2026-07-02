import { createDeepAgent } from "deepagents";
import { createFilesystemMiddleware } from "deepagents";
import { createMemoryMiddleware } from "deepagents";
import { createSkillsMiddleware } from "deepagents";
import { createSummarizationMiddleware } from "deepagents";
import { loadConfig } from "../config/loader.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FileBackend } from "./fileBackend.js";

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
	const config = loadConfig();
	const memoryDir = join(config.cwd, config.memory?.contextDir || "memory/context/");
	const allowedPaths = config.sandbox?.paths || ["./"];

	// Create file-based backend for deepagents middleware
	const fileBackend = new FileBackend(memoryDir, {
		allowedPaths: allowedPaths.map((p) => join(config.cwd, p)),
		maxReadSize: config.sandbox?.maxReadSize || "1mb",
	});

	// Resolve permission paths to absolute paths for deepagents middleware
	const resolvedPermissions = allowedPaths
		.filter((p) => !p.startsWith("!"))
		.map((p) => ({
			paths: [join(config.cwd, p)],
		}));

	// Build middleware array
	const middleware = [
		// Filesystem middleware — replaces readFile, writeFile, patch, searchFiles
		createFilesystemMiddleware({
			backend: fileBackend,
			permissions: resolvedPermissions,
		}),
		// Memory middleware — replaces memory tool
		createMemoryMiddleware({
			backend: fileBackend,
			sources: [memoryDir],
		}),
		// Skills middleware — replaces skillView, createSkill
		createSkillsMiddleware({
			backend: fileBackend,
		}),
		// Summarization middleware — replaces compactContext, compaction
		createSummarizationMiddleware({
			backend: fileBackend,
		}),
	];

	return createDeepAgent({
		model,
		systemPrompt,
		tools,
		middleware,
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
