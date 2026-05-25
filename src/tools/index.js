import { read_file, write_file, patch, search_files } from "./filesystem.js";
import { terminal, process_tool } from "./terminal.js";
import { todo } from "./todo.js";
import { memory } from "./memory.js";
import { session_search } from "./sessionSearch.js";
import { clarify } from "./clarify.js";
import { skills_list, skill_view } from "./skills.js";
import { web_search, web_extract } from "./web.js";
import { vision_analyze } from "./vision.js";
import { image_generate } from "./image.js";
import { execute_code } from "./code.js";
import { cronjob } from "./cron.js";

/**
 * Maps tool names to required permission scopes.
 * A tool registers only when ALL its required permissions are in the enabled set.
 * Clarify is exempt (always registered) since it requires zero permissions.
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
	// Tier 2 tools
	web_search: ["network:outbound"],
	web_extract: ["network:outbound"],
	vision_analyze: [], // no permission required
	image_generate: ["network:outbound"],
	execute_code: [], // sandboxed, no permission needed
	cronjob: ["network:outbound"],
};

// All tool definitions keyed by name
const ALL_TOOLS = {
	read_file,
	write_file,
	patch,
	search_files,
	terminal,
	process: process_tool,
	todo,
	memory,
	session_search,
	clarify,
	skills_list,
	skill_view,
	web_search,
	web_extract,
	vision_analyze,
	image_generate,
	execute_code,
	cronjob,
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
 * @param {object} options - Build configuration
 * @param {string[]} options.permissions - Enabled sandbox permissions from config
 * @param {number} options.maxReadSize - Maximum read size string (e.g., "1mb")
 * @param {object} [options.registry] - SkillRegistry instance for skills_list/skill_view
 * @param {string} [options.conversationsDir] - Path to conversations directory
 * @returns {Promise<unknown[]>} Array of tool definitions
 */
export async function buildToolConfig(options) {
	const {
		permissions = [],
		maxReadSize = "1mb",
		registry,
		conversationsDir = "memory/conversations/",
	} = options;

	const enabledSet = new Set(permissions);
	const tools = [];

	for (const [toolName, requiredPerms] of Object.entries(TOOL_PERMISSIONS)) {
		const hasAllPerms = requiredPerms.every((perm) => enabledSet.has(perm));

		switch (toolName) {
			case "clarify": {
				// Always register
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			case "execute_code": {
				// No permission required, always register
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			case "web_search":
			case "web_extract": {
				// Require network:outbound + at least one search API key
				if (!hasAllPerms || !hasSearchKey()) continue;
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			case "vision_analyze": {
				// No permission required, but needs OPENAI_API_KEY
				if (!process.env.OPENAI_API_KEY) continue;
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			case "image_generate": {
				// Require network:outbound + FAL_API_KEY
				if (!hasAllPerms || !process.env.FAL_API_KEY) continue;
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			case "cronjob": {
				// Require network:outbound
				if (!hasAllPerms) continue;
				tools.push(
					createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
						maxReadSize,
						registry,
						conversationsDir,
					}),
				);
				continue;
			}

			default: {
				// Tier 1 tools: permission-based gating only
				if (requiredPerms.length === 0) {
					tools.push(
						createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
							maxReadSize,
							registry,
							conversationsDir,
						}),
					);
					continue;
				}
				if (hasAllPerms) {
					tools.push(
						createToolWithRuntimeOptions(ALL_TOOLS[toolName], {
							maxReadSize,
							registry,
							conversationsDir,
						}),
					);
				}
			}
		}
	}

	return tools;
}

/**
 * Create a tool with runtime options injected via closure.
 * The @tool decorator handles the invocation; runtime options are passed
 * through the tool's second argument during invocation.
 * @param {unknown} toolDef - The tool definition from the tool decorator
 * @param {object} runtimeOptions - Options to inject at invocation time
 * @returns {unknown} A tool with runtime options configured
 */
// eslint-disable-next-line no-unused-vars
function createToolWithRuntimeOptions(toolDef, runtimeOptions) {
	// The runtime options need to be available at invocation time.
	// LangChain's @tool decorator passes runtime options as the second argument.
	// We return the tool definition as-is and configure runtime options
	// through the agent's tool context at runtime.
	return toolDef;
}
