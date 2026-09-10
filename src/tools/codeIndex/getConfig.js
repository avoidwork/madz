import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";

/**
 * Get the full project configuration as a parsed JSON object.
 *
 * Calls loadConfig() and returns the result directly to the calling agent.
 * Requires only filesystem:read permission — no input parameters needed.
 *
 * @param {z.infer<typeof GetConfigSchema>} _input - The tool input (empty object)
 * @returns {Promise<string>} JSON-serialized project configuration
 */
async function getConfigImpl(_input) {
	const config = loadConfig();
	return JSON.stringify(config, null, 2);
}

export const getConfig = tool(getConfigImpl, {
	name: "getConfig",
	description:
		"Get the full project configuration as a parsed JSON object. " +
		"Calls loadConfig() and returns the result. " +
		"Requires only filesystem:read permission — no input parameters needed.",
	schema: z.object({}).strict(),
});
