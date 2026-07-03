import {
	createDeepAgent,
	CompositeBackend,
	createSubAgent,
	createSubAgentMiddleware,
	createFilesystemMiddleware,
	createMemoryMiddleware,
	createSummarizationMiddleware,
	createPatchToolCallsMiddleware,
} from "deepagents";
import { todoListMiddleware } from "langchain";
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

// Skill classification map — classifies each skill by agent type.
// Skills are discovered dynamically; this map provides the classification
// for filtering. Initially, all skills are classified as "subagent" since
// the orchestrator's role is coordination, not execution.
const SKILL_CLASSIFICATIONS = {
	// All skills are subagent-only by default.
	// Add entries here to classify skills as "orchestrator" or "shared".
};

/**
 * Filter skill paths by classification.
 * @param {string[]} skillPaths - All discovered skill paths
 * @param {string[]} classificationFilter - Classes to include (e.g., ['orchestrator', 'shared'])
 * @returns {string[]} Filtered skill paths
 */
function filterSkillPaths(skillPaths, classificationFilter) {
	if (!classificationFilter || classificationFilter.length === 0) {
		return skillPaths;
	}
	const filterSet = new Set(classificationFilter);
	return skillPaths.filter((path) => {
		const skillName = path.split("/").pop()?.replace(".md", "") || path;
		const classification = SKILL_CLASSIFICATIONS[skillName] || "subagent";
		return filterSet.has(classification);
	});
}

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
	const contextBackend = createContextBackend();
	const subAgentsBackend = createSubAgentsBackend();

	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

	// Filter skill paths by agent type
	const orchestratorSkills = filterSkillPaths(skillPaths, ["orchestrator", "shared"]);
	// Note: subagents receive all skills (skillPaths) — add to createSubAgent when API supports it

	const codingSubAgent = createSubAgent({
		name: "coding-agent",
		description:
			"Specialized agent for code-related tasks including file editing, debugging, implementation, and code review.",
		systemPrompt: codeAgentPrompt || "You are a coding specialist. Handle all code-related tasks.",
		model,
		tools: subagentTools,
		middleware: [
			todoListMiddleware(),
			createFilesystemMiddleware({ backend: coreBackend }),
			createSummarizationMiddleware({ backend: subAgentsBackend }),
			createPatchToolCallsMiddleware(),
			createMemoryMiddleware({ backend: subAgentsBackend }),
		],
	});

	return createDeepAgent({
		model,
		tools: orchestratorTools,
		systemPrompt,
		store: new InMemoryStore(),
		backend: new CompositeBackend(coreBackend, {
			[contextRoute]: contextBackend,
		}),
		subagents: [codingSubAgent],
		...(agentsPath && { memory: [agentsPath] }),
		...(orchestratorSkills.length > 0 && { skills: orchestratorSkills }),
		...(checkpointer && { checkpointer }),
	});
}
