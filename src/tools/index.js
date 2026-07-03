import { createTerminalTool, createProcessTool } from "./terminal.js";
import { createQueuedTodoTool } from "./todo.js";
import { createSessionSearchTool } from "./session_search.js";
import { createClarifyTool } from "./clarify.js";
import { createWebSearchTool, createWebExtractTool } from "./web.js";
import { createVisionTool } from "./vision.js";
import { createImageTool } from "./image.js";
import { createCodeTool } from "./code.js";
import { createCronTool } from "./cron.js";
import { createTtsTool } from "./tts.js";
import { createMoaTool } from "./moa.js";
import { createSamplingTool } from "./sampling.js";
import { createDateTool } from "./date.js";
import { createScanAgentsTool } from "./scanAgents.js";

/**
 * Maps tool names to required permission scopes.
 * A tool registers only when ALL its required permissions are in the enabled set.
 * Clarify and execute_code are exempt (always registered) since they require zero permissions.
 */
export const TOOL_PERMISSIONS = {
	terminal: ["filesystem:exec", "process:spawn"],
	process: ["process:spawn"],
	todo: ["filesystem:read", "filesystem:write"],
	sessionSearch: ["filesystem:read"],
	clarify: [],
	webSearch: ["network:outbound"],
	webExtract: ["network:outbound"],
	visionAnalyze: [],
	imageGenerate: ["network:outbound"],
	executeCode: [],
	cronJob: ["network:outbound"],
	textToSpeech: [],
	mixtureOfAgents: [],
	sampling: [],
	date: [],
	scanAgents: [],
};

// Factory functions keyed by tool name
const TOOL_FACTORIES = {
	terminal: createTerminalTool,
	process: createProcessTool,
	todo: createQueuedTodoTool,
	sessionSearch: createSessionSearchTool,
	clarify: createClarifyTool,
	webSearch: createWebSearchTool,
	webExtract: createWebExtractTool,
	visionAnalyze: createVisionTool,
	imageGenerate: createImageTool,
	executeCode: createCodeTool,
	cronJob: createCronTool,
	textToSpeech: createTtsTool,
	mixtureOfAgents: createMoaTool,
	sampling: createSamplingTool,
	date: createDateTool,
	scanAgents: createScanAgentsTool,
};

/**
 * Maps tool names to their agent type classification.
 * - `orchestrator`: Tools the orchestrator uses for coordination (delegation, routing, synthesis)
 * - `subagent`: Tools subagents use for execution (code editing, terminal, file operations)
 * - `shared`: Tools both orchestrator and subagents may need
 */
export const TOOL_CLASSIFICATIONS = {
	terminal: "subagent", // Execution: terminal access for subagents
	process: "subagent", // Execution: process management for subagents
	todo: "subagent", // Execution: task management for subagents
	sessionSearch: "orchestrator", // Coordination: orchestrator searches past sessions for context
	clarify: "shared", // Both: may need to clarify with user
	webSearch: "shared", // Both: may need to search the web
	webExtract: "shared", // Both: may need to extract web content
	visionAnalyze: "shared", // Both: may need to analyze images
	imageGenerate: "subagent", // Execution: image generation for subagents
	executeCode: "subagent", // Execution: code execution for subagents
	cronJob: "subagent", // Execution: scheduling for subagents
	textToSpeech: "subagent", // Execution: TTS for subagents
	mixtureOfAgents: "orchestrator", // Coordination: MOA for orchestrator decision-making
	sampling: "orchestrator", // Coordination: memory sampling for orchestrator
	date: "shared", // Both: may need date/time info
	scanAgents: "orchestrator", // Coordination: scanning for AGENTS.md files
};

/**
 * Build an array of LangChain tools gated by sandbox permissions and API keys.
 * Each tool is created with runtime options captured in a closure, ensuring
 * the impl function receives them as its second argument on every invocation.
 * @param {object} options - Build configuration
 * @param {string[]} options.permissions - Enabled sandbox permissions from config
 * @param {string[]} options.allowedPaths - Sandbox-allowed paths
 * @param {string} options.maxReadSize - Maximum read size string (e.g., "1mb")
 * @param {object} [options.registry] - SkillRegistry instance for skills_list/skill_view
 * @param {string} [options.sessionsDir] - Path to sessions directory
 * @param {object} [options.safety] - Code sandbox safety config
 * @param {object} [options.timeout] - Code execution timeout config
 * @param {string} [options.memoryLimit] - Code execution memory limit string
 * @param {string} [options.contextDir] - Directory for memory entries
 * @param {number} [options.ephemeralTtlDays] - TTL for ephemeral memories
 * @param {number} [options.ephemeralMaxEntries] - Max concurrent ephemeral entries
 * @param {string[]} [options.classificationFilter] - Filter tools by classification (e.g., ['orchestrator', 'shared']). When omitted, all tools are included.
 * @param {object} [options.config] - Resolved config object from loadConfig()
 * @param {object} [options.config.providers] - Provider configs (openai, openrouter, fal)
 * @param {object} [options.config.search] - Search backend configs
 * @returns {Promise<object[]>} Array of LangChain Tool instances
 */
export async function buildToolConfig(options) {
	const {
		permissions = [],
		allowedPaths = [],
		maxReadSize = "1mb",
		registry,
		sessionsDir = "memory/sessions/",
		safety,
		timeout,
		memoryLimit,
		contextDir = "memory/context/",
		ephemeralTtlDays = 7,
		ephemeralMaxEntries = 10,
		classificationFilter,
		config,
	} = options;

	// Extract resolved API keys from config fallback
	const providers = config?.providers || {};
	const providersOpenAI = providers?.openai || {};
	const providersOpenRouter = providers?.openrouter || {};
	const providersFal = providers?.fal || {};
	const credentials = providersOpenAI?.credentials || {};
	const openrouterCredentials = providersOpenRouter?.credentials || {};
	const falCredentials = providersFal?.credentials || {};

	const search = config?.search || {};
	const searchExa = search?.exa || {};
	const searchFirecrawl = search?.firecrawl || {};
	const searchTavily = search?.tavily || {};
	const searchParallel = search?.parallel || {};
	const searchSearxng = search?.searxng || {};
	const searchBing = search?.bing || {};
	const searchCustom = search?.custom || {};

	const enabledSet = new Set(permissions);
	const tools = [];
	const runtimeOptions = {
		allowedPaths,
		maxReadSize,
		registry,
		sessionsDir,
		safety,
		timeout,
		memoryLimit,
		contextDir,
		ephemeralTtlDays,
		ephemeralMaxEntries,
		// Resolved provider API keys from config (env var resolved values)
		openaiApiKey: credentials?.apiKey,
		openrouterApiKey: openrouterCredentials?.apiKey,
		falApiKey: falCredentials?.apiKey,
		// Resolved search backend configs from config
		searchExaApiKey: searchExa?.apiKey,
		searchFirecrawlApiKey: searchFirecrawl?.apiKey,
		searchTavilyApiKey: searchTavily?.apiKey,
		searchParallelApiKey: searchParallel?.apiKey,
		searchSearxngUrl: searchSearxng?.url,
		searchBingApiKey: searchBing?.apiKey,
		searchCustomConfig: {
			url: searchCustom?.url,
			method: searchCustom?.method,
			body: searchCustom?.body,
			headers: searchCustom?.headers,
			queryKey: searchCustom?.queryKey,
			titleField: searchCustom?.titleField,
			urlField: searchCustom?.urlField,
			descriptionField: searchCustom?.descriptionField,
			apiKey: searchCustom?.apiKey,
		},
	};

	for (const [toolName, requiredPerms] of Object.entries(TOOL_PERMISSIONS)) {
		const hasAllPerms = requiredPerms.every((perm) => enabledSet.has(perm));

		switch (toolName) {
			case "clarify":
			case "executeCode":
			case "sampling":
			case "date":
			case "scanAgents": {
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "webSearch":
			case "webExtract": {
				if (!hasAllPerms) continue;
				const hasAnySearch =
					runtimeOptions.searchExaApiKey ||
					runtimeOptions.searchFirecrawlApiKey ||
					runtimeOptions.searchTavilyApiKey ||
					runtimeOptions.searchParallelApiKey ||
					runtimeOptions.searchSearxngUrl ||
					runtimeOptions.searchBingApiKey ||
					(runtimeOptions.searchCustomConfig?.url &&
						runtimeOptions.searchCustomConfig?.apiKey !== undefined);
				if (!hasAnySearch) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "visionAnalyze": {
				if (!runtimeOptions.openaiApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "imageGenerate": {
				if (!hasAllPerms || !runtimeOptions.falApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "cronJob":
			case "textToSpeech":
			case "mixtureOfAgents": {
				if (toolName === "cronJob" && !hasAllPerms) continue;
				if (toolName === "textToSpeech" && !runtimeOptions.openaiApiKey) continue;
				if (toolName === "mixtureOfAgents" && !runtimeOptions.openrouterApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			default: {
				if (requiredPerms.length > 0 && !hasAllPerms) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
			}
		}
	}

	// Filter by classification if a filter is provided
	if (classificationFilter && classificationFilter.length > 0) {
		const filterSet = new Set(classificationFilter);
		const filteredTools = [];
		for (const tool of tools) {
			const classification = TOOL_CLASSIFICATIONS[tool.name];
			if (classification && filterSet.has(classification)) {
				filteredTools.push(tool);
			}
		}
		return filteredTools;
	}

	return tools;
}
