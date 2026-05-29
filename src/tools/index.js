import {
	createReadFileTool,
	createWriteFileTool,
	createPatchTool,
	createSearchFilesTool,
} from "./filesystem.js";
import { createTerminalTool, createProcessTool } from "./terminal.js";
import { createTodoTool } from "./todo.js";
import { createMemoryTool } from "./memory.js";
import { createSessionSearchTool } from "./sessionSearch.js";
import { createClarifyTool } from "./clarify.js";
import { createSkillsListTool, createSkillViewTool } from "./skills.js";
import { createWebSearchTool, createWebExtractTool } from "./web.js";
import { createVisionTool } from "./vision.js";
import { createImageTool } from "./image.js";
import { createCodeTool } from "./code.js";
import { createCronTool } from "./cron.js";
import { createTtsTool } from "./tts.js";
import { createMoaTool } from "./moa.js";

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
	skills_list: ["filesystem:read"],
	skill_view: ["filesystem:read"],
	// Tier 2 tools (need env vars in addition to permissions where applicable)
	web_search: ["network:outbound"],
	web_extract: ["network:outbound"],
	vision_analyze: [], // requires OPENAI_API_KEY
	image_generate: ["network:outbound"], // requires FAL_API_KEY
	execute_code: [], // sandboxed, no permission needed
	cronjob: ["network:outbound"],
	text_to_speech: [], // requires OPENAI_API_KEY
	mixture_of_agents: [], // requires OPENROUTER_API_KEY
};

// Factory functions keyed by tool name
const TOOL_FACTORIES = {
	read_file: createReadFileTool,
	write_file: createWriteFileTool,
	patch: createPatchTool,
	search_files: createSearchFilesTool,
	terminal: createTerminalTool,
	process: createProcessTool,
	todo: createTodoTool,
	memory: createMemoryTool,
	session_search: createSessionSearchTool,
	clarify: createClarifyTool,
	skills_list: createSkillsListTool,
	skill_view: createSkillViewTool,
	web_search: createWebSearchTool,
	web_extract: createWebExtractTool,
	vision_analyze: createVisionTool,
	image_generate: createImageTool,
	execute_code: createCodeTool,
	cronjob: createCronTool,
	text_to_speech: createTtsTool,
	mixture_of_agents: createMoaTool,
};

/**
 * Detect which search API key is available.
 * @returns {boolean} True if at least one key is set
 */
function hasSearchKey() {
	return (
		process.env.EXA_API_KEY ||
		process.env.FIRECRAWL_API_KEY ||
		process.env.TAVILY_API_KEY ||
		process.env.PARALLEL_API_KEY
	);
}

/**
 * Build an array of LangChain tools gated by sandbox permissions and API keys.
 * Each tool is created with runtime options captured in a closure, ensuring
 * the impl function receives them as its second argument on every invocation.
 * @param {object} options - Build configuration
 * @param {string[]} options.permissions - Enabled sandbox permissions from config
 * @param {string[]} options.allowedPaths - Sandbox-allowed paths
 * @param {string} options.maxReadSize - Maximum read size string (e.g., "1mb")
 * @param {object} [options.registry] - SkillRegistry instance for skills_list/skill_view
 * @param {string} [options.conversationsDir] - Path to conversations directory
 * @param {object} [options.safety] - Code sandbox safety config
 * @param {object} [options.timeout] - Code execution timeout config
 * @param {string} [options.memoryLimit] - Code execution memory limit string
 * @returns {Promise<object[]>} Array of LangChain Tool instances
 */
export async function buildToolConfig(options) {
	const {
		permissions = [],
		allowedPaths = ["memory/", "skills/", "tmp/"],
		maxReadSize = "1mb",
		registry,
		conversationsDir = "memory/conversations/",
		safety,
		timeout,
		memoryLimit,
	} = options;

	const enabledSet = new Set(permissions);
	const tools = [];
	const runtimeOptions = {
		allowedPaths,
		maxReadSize,
		registry,
		conversationsDir,
		safety,
		timeout,
		memoryLimit,
	};

	for (const [toolName, requiredPerms] of Object.entries(TOOL_PERMISSIONS)) {
		const hasAllPerms = requiredPerms.every((perm) => enabledSet.has(perm));

		switch (toolName) {
			case "clarify":
			case "execute_code": {
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "web_search":
			case "web_extract": {
				if (!hasAllPerms || !hasSearchKey()) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "vision_analyze": {
				if (!process.env.OPENAI_API_KEY) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "image_generate": {
				if (!hasAllPerms || !process.env.FAL_API_KEY) continue;
				tools.push(TOOL_FACTORIES[toolName](runtimeOptions));
				continue;
			}

			case "cronjob":
			case "text_to_speech":
			case "mixture_of_agents": {
				if (toolName === "cronjob" && !hasAllPerms) continue;
				if (toolName === "text_to_speech" && !process.env.OPENAI_API_KEY) continue;
				if (toolName === "mixture_of_agents" && !process.env.OPENROUTER_API_KEY) continue;
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
