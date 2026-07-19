import { clarify } from "./clarify.js";
import { executeCode } from "./code.js";
import { createCompactContextTool } from "./compact_context.js";
import { cronJob } from "./cron.js";
import { date } from "./date.js";
import { scanAgents } from "./scanAgents.js";
import { imageGenerate } from "./image.js";
import { memory } from "./memory.js";
import { mixtureOfAgents } from "./moa.js";
import { sampling } from "./sampling.js";
import { sessionSearch } from "./session_search.js";
import { shell, processTool } from "./shell.js";
import { createSkill, skillView, skillsList } from "./skills.js";
import { textToSpeech } from "./tts.js";
import { visionAnalyze } from "./vision.js";
import { webSearch, webExtract } from "./web.js";

/**
 * Maps tool names to required permission scopes.
 * A tool registers only when ALL its required permissions are in the enabled set.
 * Clarify and execute_code are exempt (always registered) since they require zero permissions.
 */
export const TOOL_PERMISSIONS = {
	clarify: ["filesystem:read", "filesystem:write"],
	compactContext: ["filesystem:read"],
	cronJob: ["network:outbound"],
	createSkill: ["filesystem:write"],
	date: [],
	executeCode: ["filesystem:exec", "process:spawn"],
	imageGenerate: ["network:outbound"],
	memory: ["filesystem:read", "filesystem:write"],
	mixtureOfAgents: ["network:outbound"],
	process: ["process:spawn"],
	sampling: ["filesystem:write"],
	scanAgents: ["filesystem:read"],
	sessionSearch: ["filesystem:read"],
	shell: ["filesystem:exec", "process:spawn"],
	skillView: ["filesystem:read"],
	skillsList: ["filesystem:read"],
	textToSpeech: [],
	visionAnalyze: [],
	webExtract: ["network:outbound"],
	webSearch: ["network:outbound"],
};

/**
 * Maps tool names to agent type classifications.
 * Each tool can be classified for one or more agent types.
 * @type {Record<string, string[]>}
 */
export const TOOL_CLASSIFICATIONS = {
	clarify: [
		"search",
		"debug",
		"code-review",
		"research",
		"testing",
		"documentation",
		"security-audit",
		"performance",
	],
	compactContext: ["debug", "code-review", "research"],
	cronJob: ["security-audit", "performance"],
	createSkill: ["documentation"],
	date: [
		"search",
		"debug",
		"code-review",
		"research",
		"testing",
		"documentation",
		"security-audit",
		"performance",
	],
	executeCode: ["debug", "code-review", "testing", "performance"],
	imageGenerate: ["documentation"],
	memory: [
		"search",
		"debug",
		"code-review",
		"research",
		"testing",
		"documentation",
		"security-audit",
		"performance",
	],
	mixtureOfAgents: ["research"],
	process: ["debug", "performance"],
	sampling: ["documentation"],
	scanAgents: ["security-audit", "code-review"],
	sessionSearch: ["search", "research"],
	shell: ["debug", "code-review", "testing", "security-audit", "performance"],
	skillView: ["search", "research", "code-review"],
	skillsList: ["search", "research", "code-review"],
	textToSpeech: ["documentation"],
	visionAnalyze: ["code-review", "testing"],
	webExtract: ["search", "research"],
	webSearch: ["search", "research"],
};

/**
 * Get tools filtered by agent type classification.
 * @param {string[]} agentTypes - Array of agent type classifications (e.g., ["search", "debug"])
 * @param {object} tools - The full tools object from TOOLS
 * @returns {string[]} Array of tool names matching the agent types
 */
export function getToolsForAgentTypes(agentTypes, tools) {
	const toolNames = Object.keys(tools);
	return toolNames.filter((toolName) => {
		const classifications = TOOL_CLASSIFICATIONS[toolName] || [];
		return agentTypes.some((type) => classifications.includes(type));
	});
}

/**
 * Tools available to the orchestrator.
 * These are general-purpose tools for communication, context management, and lookup.
 * Domain-specific tools are delegated to subagents.
 * @type {string[]}
 */
export const ORCHESTRATOR_TOOLS = [
	"clarify",
	"compactContext",
	"date",
	"memory",
	"sessionSearch",
	"webSearch",
	"webExtract",
	"skillView",
	"skillsList",
	"scanAgents",
	"shell",
	"sampling",
	"createSkill",
];

// Tool instances keyed by tool name
export const TOOLS = {
	clarify,
	compactContext: createCompactContextTool,
	cronJob,
	createSkill,
	date,
	executeCode,
	imageGenerate,
	memory,
	mixtureOfAgents,
	process: processTool,
	sampling,
	scanAgents,
	sessionSearch,
	shell,
	skillView,
	skillsList,
	textToSpeech,
	visionAnalyze,
	webExtract,
	webSearch,
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
		config,
		checkpointer,
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
			case "sampling": {
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "compactContext": {
				if (!hasAllPerms) continue;
				tools.push(createCompactContextTool({ checkpointer }));
				continue;
			}

			case "readFile":
			case "writeFile":
			case "patch":
			case "searchFiles":
			case "scanAgents":
			case "date":
			case "cronJob": {
				if (!hasAllPerms) continue;
				tools.push(TOOLS[toolName]);
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
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "visionAnalyze": {
				if (!runtimeOptions.openaiApiKey) continue;
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "imageGenerate": {
				if (!hasAllPerms || !runtimeOptions.falApiKey) continue;
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "textToSpeech":
			case "mixtureOfAgents": {
				if (toolName === "textToSpeech" && !runtimeOptions.openaiApiKey) continue;
				if (toolName === "mixtureOfAgents" && !runtimeOptions.openrouterApiKey) continue;
				tools.push(TOOLS[toolName]);
				continue;
			}

			default: {
				if (requiredPerms.length > 0 && !hasAllPerms) continue;
				tools.push(TOOLS[toolName]);
			}
		}
	}

	return tools;
}
