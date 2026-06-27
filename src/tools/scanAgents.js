import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { validatePath } from "./common.js";
import { loadAgents } from "../workspace/loadAgents.js";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

const ScanAgentsSchema = z.object({
	path: z
		.string()
		.optional()
		.describe("Path to scan for AGENTS.md (defaults to current working directory)"),
});

/**
 * Core scanAgents logic: delegate to loadAgents with validated path.
 * @param {z.infer<typeof ScanAgentsSchema>} input - The tool input
 * @param {object} options - Runtime options (allowedPaths, maxReadSize)
 * @returns {Promise<string>} File contents or empty string
 */
export async function scanAgentsImpl(input, options) {
	const targetPath = input.path || cwd;
	const resolved = validatePath(targetPath, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	return await loadAgents(resolved.path, options.maxReadSize);
}

/**
 * Create a scanAgents tool with runtime options.
 * @param {object} options - Runtime options (allowedPaths, maxReadSize)
 * @returns {object} LangChain Tool instance
 */
export function createScanAgentsTool(_options) {
	return tool(scanAgentsImpl, {
		name: "scanAgents",
		description:
			"Scan for AGENTS.md in the current working directory or a specified path. If found, returns the file contents. If not found, returns an empty string silently.",
		schema: ScanAgentsSchema,
	});
}
