import { read_file, write_file, patch, search_files } from "./filesystem.js";
import { terminal, process_tool } from "./terminal.js";
import { todo } from "./todo.js";
import { memory } from "./memory.js";
import { session_search } from "./sessionSearch.js";
import { clarify } from "./clarify.js";
import { skills_list, skill_view } from "./skills.js";

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
};

/**
 * Build an array of LangChain tools gated by sandbox permissions.
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
		// Clarify (zero-permission tool) always registers
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

		// Check if all required permissions are enabled
		const hasAllPerms = requiredPerms.every((perm) => enabledSet.has(perm));
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
