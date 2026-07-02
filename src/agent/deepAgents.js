import {
	createDeepAgent,
	CompositeBackend,
	createSubAgent,
	createFilesystemMiddleware,
	createMemoryMiddleware,
} from "deepagents";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { loadConfig } from "../config/loader.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { SkillRegistry } from "../skills/registry.js";
import { createChatModel } from "../provider/openai.js";
import { buildToolConfig } from "../tools/index.js";
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
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Object} Deep Agents orchestrator instance
 */
export async function createDeepAgentsOrchestrator(checkpointer = null) {
	const config = loadConfig();
	const systemPrompt = loadSystemPrompt();
	const codeAgentPrompt = loadCodeAgentPrompt();
	const agentsPath = join(config.cwd, "AGENTS.md");

	// Discover skills from configured scopes
	const skillRegistry = new SkillRegistry();
	skillRegistry.discover();
	const skillPaths = skillRegistry.getSkillPaths();

	// Create model from config
	const providerName = Object.keys(config.providers)[0] || "openai";
	const providerConfig = config.providers[providerName] || {};
	const model = createChatModel(providerConfig);

	// Build tools from config
	const tools = await buildToolConfig({
		permissions: config.sandbox.permissions || [],
		allowedPaths: config.sandbox.paths,
		maxReadSize: config.sandbox.maxReadSize || "1mb",
		registry: skillRegistry,
		sessionsDir: join(config.cwd, config.memory.sessionsDir),
		safety: config.sandbox.safety,
		timeout: config.sandbox.timeout,
		memoryLimit: config.sandbox.memoryLimit,
		contextDir: join(config.cwd, config.memory.contextDir),
		ephemeralTtlDays: config.memory?.ephemeral?.ttlDays || 7,
		ephemeralMaxEntries: config.memory?.ephemeral?.maxEntries || 10,
		config,
		checkpointer,
	});

	const coreBackend = createCoreBackend();
	const contextBackend = createContextBackend();
	const subAgentsBackend = createSubAgentsBackend();

	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

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
			[contextRoute]: contextBackend,
		}),
		subagents: [codingSubAgent],
		...(agentsPath && { memory: [agentsPath] }),
		...(skillPaths.length > 0 && { skills: skillPaths }),
		...(checkpointer && { checkpointer }),
	});
}
