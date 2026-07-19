import { createDeepAgent, CompositeBackend } from "deepagents";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { loadConfig } from "../config/loader.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { SkillRegistry } from "../skills/registry.js";
import { createChatModel } from "../provider/openai.js";
import { buildToolConfig, getToolsForAgentTypes, TOOL_CLASSIFICATIONS, TOOLS } from "../tools/index.js";
import { createCoreBackend } from "./coreBackend.js";
import { createContextBackend } from "./contextBackend.js";
import { createDmzBackend } from "./dmzBackend.js";
import { AgentRegistry } from "./agentRegistry.js";
import { getAllAgents } from "./agents/index.js";
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
 * Get tool classifications for an agent by name.
 * Maps agent names to their required tool classifications.
 * @param {string} agentName - Agent name
 * @returns {string[]} Array of tool classifications
 */
function getAgentClassifications(agentName) {
	const classificationMap = {
		search: ["webSearch", "webExtract", "grep", "glob", "sessionSearch"],
		debug: ["readFile", "grep", "glob", "executeCode", "shell"],
		"code-review": ["readFile", "grep", "glob", "executeCode"],
		research: ["webSearch", "webExtract", "grep", "glob", "sessionSearch"],
		testing: ["readFile", "grep", "glob", "executeCode", "shell"],
		documentation: ["readFile", "writeFile", "grep", "glob"],
		"security-audit": ["readFile", "grep", "glob", "shell"],
		performance: ["readFile", "executeCode", "grep", "shell"],
	};
	return classificationMap[agentName] || [];
}

/**
 * Create subagent definitions with filtered tools.
 * @param {Object} buildOptions - Build options for tool creation
 * @param {Object} model - Chat model instance
 * @returns {Object[]} Array of subagent definitions
 */
function createSubagentDefinitions(buildOptions, model) {
	const allAgents = getAllAgents();

	return allAgents.map((agentDef) => {
		const classifications = getAgentClassifications(agentDef.name);
		const filteredToolNames = getToolsForAgentTypes(classifications, TOOLS);
		return {
			...agentDef,
			model,
			tools: filteredToolNames,
		};
	});
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

	// Create subagent definitions with filtered tools
	const subagentDefinitions = createSubagentDefinitions(buildOptions, model);

	// Build filtered tool sets for each agent type
	const agentToolSets = {};
	for (const agentDef of subagentDefinitions) {
		const classifications = getAgentClassifications(agentDef.name);
		const filteredToolNames = getToolsForAgentTypes(classifications, TOOLS);
		agentToolSets[agentDef.name] = filteredToolNames;
		logger.info(
			{ agent: agentDef.name, tools: filteredToolNames },
			`Agent "${agentDef.name}" has ${filteredToolNames.length} tools`,
		);
	}

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
		subagents: subagentDefinitions,
		...(agentsPath && { memory: [agentsPath] }),
		...(skillPaths.length > 0 && { skills: skillPaths }),
		...(checkpointer && { checkpointer }),
	});
}
