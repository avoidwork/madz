import { clarify } from "./clarify/index.js";
import { cronJob } from "./cron/index.js";
import { date } from "./date/index.js";
import { scanAgents } from "./scanAgents/index.js";
import { generateImage } from "./image/index.js";
import { readImage } from "./image/readImage.js";
import { memory } from "./memory/index.js";
import { sampling } from "./sampling/index.js";
import { searchSession } from "./session/index.js";
import { processTool } from "./process/index.js";
import { createSkill } from "./skills/index.js";
import { textToSpeech } from "./tts/index.js";
import { searchWeb, extractWeb, renderWeb, screenshotWeb } from "./web/index.js";
import { docxTool, pdfTool, pptxTool, xlsxTool } from "./fileExtract/index.js";
import { reflectionSessions } from "./reflection/index.js";
import { email } from "./email/tools.js";
import { spreadsheet } from "./spreadsheet/index.js";
import { calendar } from "./calendar/index.js";
import { generatePdfTool } from "./pdf/index.js";
import { namecom } from "./dns/index.js";
import { generatePptxTool } from "./pptx/index.js";
import { createApiTool } from "./api/index.js";
import { createGraphqlTool } from "./graphql/index.js";
import { createJsonTool } from "./json/index.js";
import { createYamlTool } from "./yaml/index.js";
import { createDataTool } from "./data/index.js";
import { createWebhookTool } from "./webhook/index.js";
import { searchCode, indexCode } from "./code/index.js";
import { getConfig } from "./config/index.js";
import { decision, decisionImpl, DecisionToolSchema } from "./decision/index.js";
import { tool } from "@langchain/core/tools";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { logger } from "../shared/logger.js";

/**
 * Maps tool names to required permission scopes.
 * A tool registers only when ALL its required permissions are in the enabled set.
 * Clarify, sampling, and process are exempt (always registered).
 */
export const TOOL_PERMISSIONS = {
	clarify: ["filesystem:read", "filesystem:write"],
	cronJob: ["network:outbound"],
	createSkill: ["filesystem:write"],
	date: [],
	generateImage: ["network:outbound"],
	readImage: ["filesystem:read"],
	memory: ["filesystem:read", "filesystem:write"],
	process: ["filesystem:exec", "process:spawn"],
	sampling: ["filesystem:write"],
	scanAgents: ["filesystem:read"],
	searchSession: ["filesystem:read"],
	textToSpeech: [],
	extractWeb: ["network:outbound"],
	searchWeb: ["network:outbound"],
	renderWeb: ["network:outbound"],
	screenshotWeb: ["network:outbound"],
	docx: ["filesystem:read"],
	pptx: ["filesystem:read"],
	xlsx: ["filesystem:read"],
	pdf: ["filesystem:read"],
	reflectionSessions: ["filesystem:read"],
	email: ["network:outbound"],
	spreadsheet: ["filesystem:read", "filesystem:write"],
	calendar: ["network:outbound"],
	generatePdf: ["filesystem:read", "filesystem:write", "network:outbound"],
	namecom: ["network:outbound"],
	generatePptx: ["filesystem:write"],
	api: ["network:outbound"],
	graphql: ["network:outbound"],
	json: ["filesystem:read"],
	yaml: ["filesystem:read"],
	data: ["filesystem:read"],
	webhook: ["filesystem:read", "filesystem:write"],
	searchCode: ["filesystem:read"],
	indexCode: ["filesystem:read", "filesystem:write"],
	getConfig: ["filesystem:read"],
	decision: ["network:outbound"],
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
		"coding",
	],
	cronJob: ["orchestrator", "security-audit", "performance"],
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
		"coding",
	],
	generateImage: ["documentation"],
	readImage: ["search", "research", "coding", "documentation", "debug"],
	memory: [
		"search",
		"debug",
		"code-review",
		"research",
		"testing",
		"documentation",
		"security-audit",
		"performance",
		"coding",
	],
	process: ["debug", "performance", "coding"],
	sampling: ["documentation"],
	scanAgents: ["security-audit", "code-review", "coding"],
	searchSession: ["search", "research"],
	textToSpeech: ["documentation"],
	extractWeb: ["search", "research", "coding"],
	searchWeb: ["search", "research", "coding"],
	renderWeb: ["search", "research", "coding"],
	screenshotWeb: ["search", "research", "coding"],
	docx: ["search", "research", "coding", "documentation", "debug"],
	pptx: ["search", "research", "coding", "documentation", "debug"],
	xlsx: ["search", "research", "coding", "documentation", "debug"],
	pdf: ["search", "research", "coding", "documentation", "debug"],
	reflectionSessions: ["orchestrator"],
	email: ["search", "research", "coding", "documentation", "debug"],
	spreadsheet: ["search", "research", "coding", "documentation", "debug"],
	calendar: ["search", "research", "coding", "documentation", "debug", "performance"],
	generatePdf: ["search", "research", "coding", "documentation", "debug"],
	namecom: ["search", "research", "coding", "documentation", "debug"],
	generatePptx: ["search", "research", "coding", "documentation", "debug"],
	api: ["search", "research", "coding", "documentation", "debug"],
	graphql: ["search", "research", "coding", "documentation", "debug"],
	json: ["search", "research", "coding", "documentation", "debug"],
	yaml: ["search", "research", "coding", "documentation", "debug"],
	data: ["search", "research", "coding", "documentation", "debug"],
	webhook: ["search", "research", "coding", "documentation", "debug"],
	searchCode: [
		"search",
		"research",
		"coding",
		"code-review",
		"debug",
		"security-audit",
		"testing",
		"performance",
		"documentation",
		"seoAnalyst",
	],
	indexCode: ["coding", "debug", "performance"],
	getConfig: [
		"coding",
		"debug",
		"performance",
		"search",
		"code-review",
		"research",
		"testing",
		"documentation",
		"security-audit",
	],
	decision: ["orchestrator", "coding", "research"],
};

/**
 * Classifications for dynamically-discovered MCP tools, keyed by tool name.
 * Populated at runtime by `buildToolConfig()` from each server's `agents` list.
 * @type {Record<string, string[]>}
 */
export const MCP_TOOL_CLASSIFICATIONS = {};

/**
 * Register the classifications for a set of dynamically-discovered MCP tools.
 * @param {string[]} toolNames - Names of the discovered MCP tools
 * @param {string[]} agentTypes - Agent type classifications for these tools
 */
export function registerMcpToolClassifications(toolNames, agentTypes) {
	for (const name of toolNames) {
		MCP_TOOL_CLASSIFICATIONS[name] = agentTypes;
	}
}

/**
 * Get tools filtered by agent type classification.
 * @param {string[]} agentTypes - Array of agent type classifications (e.g., ["search", "debug"])
 * @param {object} tools - The full tools object from TOOLS
 * @returns {string[]} Array of tool names matching the agent types
 */
export function getToolsForAgentTypes(agentTypes, tools) {
	const toolNames = Object.keys(tools);
	const staticMatches = toolNames.filter((toolName) => {
		const classifications = TOOL_CLASSIFICATIONS[toolName] || [];
		return agentTypes.some((type) => classifications.includes(type));
	});

	// Include dynamically-discovered MCP tools whose classification matches.
	const mcpMatches = Object.keys(MCP_TOOL_CLASSIFICATIONS).filter((toolName) => {
		const classifications = MCP_TOOL_CLASSIFICATIONS[toolName] || [];
		return agentTypes.some((type) => classifications.includes(type));
	});

	return [...staticMatches, ...mcpMatches];
}

/**
 * Tools available to the orchestrator.
 * These are general-purpose tools for communication, context management, and lookup.
 * Domain-specific tools are delegated to subagents.
 * @type {string[]}
 */
export const ORCHESTRATOR_TOOLS = [
	"clarify",
	"cronJob",
	"date",
	"memory",
	"process",
	"reflectionSessions",
	"searchSession",
	"searchWeb",
	"extractWeb",
	"renderWeb",
	"screenshotWeb",
	"scanAgents",
	"sampling",
	"createSkill",
	"searchCode",
	"indexCode",
	"getConfig",
	"readImage",
	"decision",
];

// Tool instances keyed by tool name
export const TOOLS = {
	clarify,
	cronJob,
	createSkill,
	date,
	generateImage,
	readImage,
	memory,
	process: processTool,
	sampling,
	scanAgents,
	searchSession,
	textToSpeech,
	extractWeb,
	searchWeb,
	renderWeb,
	screenshotWeb,
	docx: docxTool,
	pptx: pptxTool,
	xlsx: xlsxTool,
	pdf: pdfTool,
	reflectionSessions,
	email,
	spreadsheet,
	calendar,
	generatePdf: generatePdfTool,
	namecom,
	generatePptx: generatePptxTool,
	api: createApiTool,
	graphql: createGraphqlTool,
	json: createJsonTool,
	yaml: createYamlTool,
	data: createDataTool,
	webhook: createWebhookTool,
	searchCode,
	indexCode,
	getConfig,
	decision,
};

/**
 * Build an array of LangChain tools gated by sandbox permissions and API keys.
 * Each tool is created with runtime options captured in a closure, ensuring
 * the impl function receives them as its second argument on every invocation.
 * @param {object} options - Build configuration
 * @param {string[]} options.permissions - Enabled sandbox permissions from config
 * @param {string[]} options.allowedPaths - Sandbox-allowed paths
 * @param {string} options.maxReadSize - Maximum read size string (e.g., "1mb")
 * @param {object} [options.registry] - SkillRegistry instance for skill creation
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
	} = options;

	// Extract resolved API keys from config fallback
	const providers = config?.providers || {};
	const providersOpenAI = providers?.openai || {};
	const providersFal = providers?.fal || {};
	const credentials = providersOpenAI?.credentials || {};
	const falCredentials = providersFal?.credentials || {};

	const search = config?.search || {};
	const searchExa = search?.exa || {};
	const searchFirecrawl = search?.firecrawl || {};
	const searchTavily = search?.tavily || {};
	const searchBrave = search?.brave || {};
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
		falApiKey: falCredentials?.apiKey,
		// Resolved search backend configs from config
		searchExaApiKey: searchExa?.apiKey,
		searchFirecrawlApiKey: searchFirecrawl?.apiKey,
		searchTavilyApiKey: searchTavily?.apiKey,
		searchBraveApiKey: searchBrave?.apiKey,
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
		// Resolved decision config from config.agent.decision
		decisionConfig: config?.agent?.decision,
	};

	for (const [toolName, requiredPerms] of Object.entries(TOOL_PERMISSIONS)) {
		const hasAllPerms = requiredPerms.every((perm) => enabledSet.has(perm));

		switch (toolName) {
			case "clarify":
			case "sampling":
			case "process": {
				tools.push(TOOLS[toolName]);
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

			case "searchWeb":
			case "extractWeb": {
				if (!hasAllPerms) continue;
				// DuckDuckGo is the always-available keyless fallback engine,
				// so searchWeb/extractWeb are always registered.
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "generateImage": {
				if (!hasAllPerms || !runtimeOptions.falApiKey) continue;
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "textToSpeech": {
				if (!runtimeOptions.openaiApiKey) continue;
				tools.push(TOOLS[toolName]);
				continue;
			}

			case "decision": {
				if (!hasAllPerms || !runtimeOptions.decisionConfig?.baseUrl) continue;
				const decisionTool = tool(
					(input, options = {}) =>
						decisionImpl(input, { ...options, decisionConfig: runtimeOptions.decisionConfig }),
					{ name: "decision", description: TOOLS.decision.description, schema: DecisionToolSchema },
				);
				tools.push(decisionTool);
				continue;
			}

			case "api":
			case "graphql":
			case "json":
			case "yaml":
			case "data":
			case "webhook": {
				if (!hasAllPerms) continue;
				tools.push(TOOLS[toolName]());
				continue;
			}

			default: {
				if (requiredPerms.length > 0 && !hasAllPerms) continue;
				tools.push(TOOLS[toolName]);
			}
		}
	}

	// Discover and register MCP server tools. MCP tools are dynamic (discovered
	// at runtime), so they are appended to the tool list rather than added to
	// the static TOOLS map. The adapter stays open for the agent's lifetime and
	// is attached to the returned array so the caller can close it on shutdown.
	const mcpServers = config?.mcp?.servers || {};
	if (Object.keys(mcpServers).length > 0) {
		try {
			// The adapter's config schema is strict and rejects madz-specific
			// fields (e.g. `agents`). Strip those before constructing the
			// adapter, keeping only the transport connection params.
			const adapterServers = {};
			for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
				const { agents: _agents, ...connection } = serverConfig;
				adapterServers[serverName] = connection;
			}

			const adapter = new MCPAdapter({
				servers: adapterServers,
				onConnectionError: "ignore",
			});
			const mcpTools = await adapter.listTools();
			for (const mcpTool of mcpTools) {
				tools.push(mcpTool);
			}

			// Classify each server's tools by its `agents` list (default:
			// orchestrator only). The adapter prefixes tool names with the
			// server name, so we derive the server from the tool name prefix.
			for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
				const agentTypes = serverConfig.agents?.length > 0 ? serverConfig.agents : ["orchestrator"];
				const serverTools = mcpTools.filter((t) => t.name.startsWith(`${serverName}_`));
				registerMcpToolClassifications(
					serverTools.map((t) => t.name),
					agentTypes,
				);
			}

			// Attach the adapter to the returned array so the caller can close
			// it on shutdown. The array remains iterable for existing callers.
			tools.mcpAdapter = adapter;
			logger.info(
				{ servers: Object.keys(mcpServers), tools: mcpTools.length },
				`[mcp] Registered ${mcpTools.length} MCP tools from ${Object.keys(mcpServers).length} server(s)`,
			);
		} catch (err) {
			logger.warn({ error: err.message }, `[mcp] MCP tool discovery failed: ${err.message}`);
		}
	}

	return tools;
}
