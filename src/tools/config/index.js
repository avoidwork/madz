import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";

/**
 * Get the full harness configuration as a parsed JSON object.
 *
 * Calls loadConfig() and returns the result directly to the calling agent.
 * Requires only filesystem:read permission — no input parameters needed.
 *
 * @param {z.infer<typeof GetConfigSchema>} _input - The tool input (empty object)
 * @returns {Promise<{ ok: boolean, config?: object, error?: string }>} Structured result with the parsed config on success or an error message on failure
 */
async function getConfigImpl(_input) {
	try {
		const config = loadConfig();
		return { ok: true, config };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

export const getConfig = tool(getConfigImpl, {
	name: "getConfig",
	description:
		"Get the full harness configuration as a parsed JSON object. " +
		"Calls loadConfig() and returns the result. " +
		"Requires only filesystem:read permission — no input parameters needed.",
	schema: z.object({}).strict(),
});
