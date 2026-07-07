import { createDeepAgent, CompositeBackend } from "deepagents";
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
import { createDmzBackend } from "./dmzBackend.js";
import { logger } from "../logger.js";

function loadCodingAgentPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "CODING.md"), "utf-8");
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
	const codingAgentPrompt = loadCodingAgentPrompt();
	const agentsPath = join(config.cwd, "AGENTS.md");

	// Discover skills from configured scopes
	const skillRegistry = new SkillRegistry();
	skillRegistry.discover();
	const skillPaths = skillRegistry.getSkillPaths();

	// Create model from config
	const providerName = Object.keys(config.providers)[0] || "openai";
	const providerConfig = config.providers[providerName] || {};
	const model = createChatModel(providerConfig);

	// Register harness profile for subagents using config-derived model identifier
	/** const modelIdentifier = `${providerName}:${providerConfig.model}`;
	registerHarnessProfile(
		modelIdentifier,
		createHarnessProfile({
			excludedMiddleware: [
				"TodoListMiddleware",
				//"FilesystemMiddleware",
				"SummarizationMiddleware",
			],
			excludedTools: ["write_todos"],
		}),
	); **/

	// Build tools from config — separate sets for orchestrator and subagent
	const buildOptions = {
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
	};

	// Build all tools without filtering — pass everything to orchestrator and subagent
	const tools = await buildToolConfig(buildOptions);
	logger.info(
		{ tools: tools.map((t) => ({ name: t.name, type: typeof t, lc: t?.lc })) },
		`Tools: ${tools.length}`,
	);

	const coreBackend = createCoreBackend();
	const dmzBackend = createDmzBackend();
	const contextBackend = createContextBackend();
	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

	// All discovered skills are available to the orchestrator

	return createDeepAgent({
		model,
		tools,
		systemPrompt,
		store: new InMemoryStore(),
		backend: new CompositeBackend(coreBackend, {
			[contextRoute]: contextBackend,
			"/": dmzBackend,
		}),
		subagents: [
			{
				name: "coding",
				description:
					"Specialized agent for code-related tasks including file editing, debugging, implementation, and code review.",
				systemPrompt:
					codingAgentPrompt || "You are a coding specialist. Handle all code-related tasks.",
				model,
				tools,
			},
		],
		...(agentsPath && { memory: [agentsPath] }),
		...(skillPaths.length > 0 && { skills: skillPaths }),
		...(checkpointer && { checkpointer }),
	});
}
