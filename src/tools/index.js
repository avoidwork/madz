import {
	createReadFileTool,
	createWriteFileTool,
	createPatchTool,
	createSearchFilesTool,
} from "./filesystem.js";
import { createTerminalTool, createProcessTool } from "./terminal.js";
import { createQueuedTodoTool } from "./todo.js";
import { createMemoryTool } from "./memory.js";
import { createSessionSearchTool } from "./sessionSearch.js";
import { createClarifyTool } from "./clarify.js";
import { createSkillViewTool, createCreateSkillTool } from "./skills.js";
import { createWebSearchTool, createWebExtractTool } from "./web.js";
import { createVisionTool } from "./vision.js";
import { createImageTool } from "./image.js";
import { createCodeTool } from "./code.js";
import { createCronTool } from "./cron.js";
import { createTtsTool } from "./tts.js";
import { createMoaTool } from "./moa.js";
import { createSamplingTool } from "./sampling.js";
import { createDateTool } from "./date.js";

/**
 * Maps tool names to required permission scopes.
 * A tool registers only when ALL its required permissions are in the enabled set.
 * Clarify and execute_code are exempt (always registered) since they require zero permissions.
 */
export const TOOL_PERMISSIONS = {
	read_file: ["filesystem:read"],
	write_file: ["filesystem:write"],
	patch: ["filesystem:write"],
	search_files: ["filesystem:read"],
	terminal: ["filesystem:exec", "process:spawn"],
	process: ["process:spawn"],
	todo: ["filesystem:read", "filesystem:write"],
	memory: ["filesystem:read", "filesystem:write"],
	session_search: ["filesystem:read"],
	clarify: [],
	skill_view: ["filesystem:read"],
	create_skill: ["filesystem:write"],
	// Tier 2 tools (need config values in addition to permissions where applicable)
	web_search: ["network:outbound"],
	web_extract: ["network:outbound"],
	vision_analyze: [], // requires openaiApiKey
	image_generate: ["network:outbound"], // requires falApiKey
	execute_code: [], // sandboxed, no permission needed
	cronJob: ["network:outbound"],
	text_to_speech: [], // requires openaiApiKey
	mixture_of_agents: [], // requires openrouterApiKey
	sampling: [],
	date: [],
};

// Factory functions keyed by tool name
const TOOL_FACTORIES = {
	read_file: createReadFileTool,
	write_file: createWriteFileTool,
	patch: createPatchTool,
	search_files: createSearchFilesTool,
	terminal: createTerminalTool,
	process: createProcessTool,
	todo: createQueuedTodoTool,
	memory: createMemoryTool,
	session_search: createSessionSearchTool,
	clarify: createClarifyTool,
	skill_view: createSkillViewTool,
	create_skill: createCreateSkillTool,
	web_search: createWebSearchTool,
	web_extract: createWebExtractTool,
	vision_analyze: createVisionTool,
	image_generate: createImageTool,
	execute_code: createCodeTool,
	cronJob: createCronTool,
	text_to_speech: createTtsTool,
	mixture_of_agents: createMoaTool,
	sampling: createSamplingTool,
	date: createDateTool,
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
		allowedPaths = ["memory/", "skills/", "tmp/"],
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
			case "execute_code":
			case "sampling":
			case "date": {
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "web_search":
			case "web_extract": {
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

			case "vision_analyze": {
				if (!runtimeOptions.openaiApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "image_generate": {
				if (!hasAllPerms || !runtimeOptions.falApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "cronJob":
			case "text_to_speech":
			case "mixture_of_agents": {
				if (toolName === "cronJob" && !hasAllPerms) continue;
				if (toolName === "text_to_speech" && !runtimeOptions.openaiApiKey) continue;
				if (toolName === "mixture_of_agents" && !runtimeOptions.openrouterApiKey) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			default: {
				if (requiredPerms.length > 0 && !hasAllPerms) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
			}
		}
	}

	return tools;
}
