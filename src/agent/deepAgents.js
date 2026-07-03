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
/**
 * Filter skill paths by the 'agent' metadata field from each skill's frontmatter.
 * Skills without an 'agent' metadata field default to "orchestrator".
 * @param {string[]} skillPaths - All discovered skill paths
 * @param {SkillRegistry} registry - The skill registry with metadata
 * @param {string[]} agentFilter - Agent types to include (e.g., ['orchestrator', 'shared'])
 * @returns {string[]} Filtered skill paths
 */
function filterSkillPaths(skillPaths, registry, agentFilter) {
	if (!agentFilter || agentFilter.length === 0) {
		return skillPaths;
	}
	const filterSet = new Set(agentFilter);
	return skillPaths.filter((path) => {
		const parts = path.split("/");
		const skillName = parts[parts.length - 2] || path;
		const skill = registry.get(skillName);
		const agent = skill?.metadata?.agent || "orchestrator";
		return filterSet.has(agent);
	});
}

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
	};

	// Orchestrator receives coordination tools only (orchestrator + shared classifications)
	const orchestratorTools = await buildToolConfig({
		...buildOptions,
		classificationFilter: ["orchestrator", "shared"],
	});

	// Coding subagent receives execution tools (subagent + shared classifications)
	const subagentTools = await buildToolConfig({
		...buildOptions,
		classificationFilter: ["subagent", "shared"],
	});

	const coreBackend = createCoreBackend();
	const dmzBackend = createDmzBackend();
	const contextBackend = createContextBackend();
	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

	// Filter skill paths by agent metadata field (agentskills.io spec)
	const orchestratorSkills = filterSkillPaths(skillPaths, skillRegistry, ["orchestrator", "shared"]);
	const orchestratorNames = orchestratorSkills.map((p) => p.replace(/\/$/, "").split("/").pop());
	logger.info(`Orchestrator names: ${JSON.stringify(orchestratorNames)}`);
	// Note: subagents receive all skills (skillPaths) — add to createSubAgent when API supports it

	return createDeepAgent({
		model,
		tools: orchestratorTools,
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
				systemPrompt: codingAgentPrompt || "You are a coding specialist. Handle all code-related tasks.",
				model,
				tools: subagentTools
			},
		],
		...(agentsPath && { memory: [agentsPath] }),
		...(orchestratorSkills.length > 0 && { skills: orchestratorSkills }),
		...(checkpointer && { checkpointer }),
	});
}
