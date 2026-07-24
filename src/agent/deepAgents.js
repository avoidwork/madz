import { createDeepAgent, CompositeBackend } from "deepagents";
import { join } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { loadConfig } from "../config/loader.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { SkillRegistry } from "../skills/registry.js";
import { createChatModel } from "../provider/openai.js";
import {
	buildToolConfig,
	getToolsForAgentTypes,
	ORCHESTRATOR_TOOLS,
	TOOLS,
} from "../tools/index.js";
import { createCoreBackend } from "./backends/coreBackend.js";
import { createContextBackend } from "./backends/contextBackend.js";
import { createDmzBackend } from "./backends/dmzBackend.js";
import { getAllAgents } from "./agents/index.js";
import { logger } from "../logger.js";

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
 * Create subagent definitions with filtered tools and agent-specific skills.
 * @param {Object[]} allTools - Array of built tool instances
 * @param {Object} model - Chat model instance
 * @param {SkillRegistry} skillRegistry - Skill registry instance
 * @returns {Object[]} Array of subagent definitions
 */
function createSubagentDefinitions(allTools, model, skillRegistry) {
	const allAgents = getAllAgents();

	return allAgents.map((agentDef) => {
		const classifications = getAgentClassifications(agentDef.name);
		const filteredToolNames = getToolsForAgentTypes(classifications, TOOLS);
		// Map tool names back to actual tool instances — SubAgent.specs
		// require StructuredTool[], not string names.
		const filteredTools = filteredToolNames
			.map((name) => allTools.find((t) => t.name === name))
			.filter(Boolean);

		// Get skills specific to this agent (metadata.agent === agentName)
		const agentSkills = skillRegistry.getSkillPathsForAgent(agentDef.name);

		const definition = {
			...agentDef,
			model,
			tools: filteredTools,
		};

		// Attach skills array only if this agent has coding-specific skills
		if (agentSkills.length > 0) {
			definition.skills = agentSkills;
		}

		return definition;
	});
}

/**
 * Build a skills-to-agent mapping string for the orchestrator system prompt.
 * Each line maps an agent name to its skills (by name + description).
 * @param {SkillRegistry} skillRegistry - Registered skills
 * @returns {string} Formatted skills mapping section
 */
function buildSkillsMapping(skillRegistry) {
	const catalog = skillRegistry.getCatalog();
	if (catalog.length === 0) return "";

	// Group skills by agent
	const skillsByAgent = new Map();
	for (const skill of catalog) {
		const agent = skill.metadata?.agent || "orchestrator";
		if (!skillsByAgent.has(agent)) {
			skillsByAgent.set(agent, []);
		}
		skillsByAgent.get(agent).push(skill);
	}

	const lines = ["\n### SKILL ASSIGNMENTS\n"];
	lines.push("Skills are assigned to specific agents. Route skill-based tasks to the correct agent:\n");

	for (const [agent, skills] of skillsByAgent) {
		if (agent === "orchestrator") continue; // skip orchestrator skills
		lines.push(`- **${agent}**: `);
		for (const skill of skills) {
			lines.push(`  - \`${skill.name}\` — ${skill.description}\n`);
		}
	}

	return lines.join("");
}

/**
 * Create a Deep Agents orchestrator with coding and utility sub-agents.
 * Uses deepagents middleware for filesystem, memory, skills, and summarization.
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Object} Deep Agents orchestrator instance
 */
export async function createDeepAgentsOrchestrator(checkpointer = null) {
	const config = loadConfig();
	let systemPrompt = loadSystemPrompt();
	const agentsPath = join(config.cwd, "AGENTS.md");

	// Discover skills from configured scopes
	const skillRegistry = new SkillRegistry();
	skillRegistry.discover();
	const skillPaths = skillRegistry.getSkillPaths();

	// Inject skills-to-agent mapping into the orchestrator system prompt
	const skillsMapping = buildSkillsMapping(skillRegistry);
	if (skillsMapping) {
		systemPrompt = systemPrompt + skillsMapping;
	}

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

	// Build tools from config — filter to orchestrator-only tools
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

	// Build all tools, then filter to orchestrator-only set
	const allTools = await buildToolConfig(buildOptions);
	logger.info(
		{ tools: allTools.map((t) => ({ name: t.name, type: typeof t, lc: t?.lc })) },
		`All tools: ${allTools.length}`,
	);

	// Filter to orchestrator tools only — domain-specific tools go to subagents
	const orchestratorToolNames = new Set(ORCHESTRATOR_TOOLS);
	const orchestratorTools = allTools.filter((t) => orchestratorToolNames.has(t.name));
	logger.info(
		{ tools: orchestratorToolNames.size },
		`Orchestrator tools: ${orchestratorToolNames.size}`,
	);

	const coreBackend = createCoreBackend();
	const dmzBackend = createDmzBackend();
	const contextBackend = createContextBackend();
	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

	// Create subagent definitions with filtered tools and agent-specific skills
	const subagentDefinitions = createSubagentDefinitions(allTools, model, skillRegistry);

	// All discovered skills are available to the orchestrator

	return createDeepAgent({
		model,
		tools: orchestratorTools,
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
