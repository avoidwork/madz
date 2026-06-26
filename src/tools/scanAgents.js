import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validatePath, checkFileLimit } from "./common.js";

const ScanAgentsSchema = z.object({
	path: z.string().optional().describe("Path to scan for AGENTS.md (defaults to current working directory)"),
});

/**
 * Core scanAgents logic: check for AGENTS.md at the specified path and return contents.
 * @param {z.infer<typeof ScanAgentsSchema>} input - The tool input
 * @param {object} options - Runtime options (allowedPaths, maxReadSize)
 * @returns {Promise<string>} File contents or empty string
 */
export async function scanAgentsImpl(input, options) {
	const targetPath = input.path || process.cwd();
	const resolved = validatePath(targetPath, options.allowedPaths);
	if (!resolved.allowed) {
		return `Error: ${resolved.error}`;
	}

	const agentsPath = join(resolved.path, "AGENTS.md");

	try {
		await access(agentsPath);
	} catch {
		// File not found — return empty string silently
		return "";
	}

	const limitCheck = await checkFileLimit(agentsPath, options.maxReadSize);
	if (!limitCheck.ok) {
		return limitCheck.error;
	}

	try {
		const content = await readFile(agentsPath, "utf-8");
		return content;
	} catch (err) {
		return `Error: ${err.message}`;
	}
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