import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { validatePath, checkFileLimit } from "../common.js";
import { loadAgents } from "../../workspace/loadAgents.js";
import { loadConfig } from "../../config/loader.js";

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
 * @returns {Promise<{ ok: boolean, agents?: string, error?: string }>} Structured result
 */
export async function scanAgentsImpl(input, options) {
	const targetPath = input.path || cwd;
	const resolved = validatePath(targetPath, options.allowedPaths);
	if (!resolved.allowed) {
		return { ok: false, error: resolved.error };
	}

	const agentsPath = join(resolved.path, "AGENTS.md");

	// No AGENTS.md → successful empty result
	try {
		await access(agentsPath);
	} catch {
		return { ok: true, agents: "" };
	}

	// Enforce size limit before delegating to loadAgents
	if (options.maxReadSize) {
		const limitCheck = await checkFileLimit(agentsPath, options.maxReadSize);
		if (!limitCheck.ok) {
			return { ok: false, error: limitCheck.error };
		}
	}

	return { ok: true, agents: await loadAgents(resolved.path, options.maxReadSize) };
}

/**
 * scanAgents tool — singleton export.
 */
export const scanAgents = tool(scanAgentsImpl, {
	name: "scanAgents",
	description:
		"Scan for AGENTS.md in the current working directory or a specified path. If found, returns the file contents. If not found, returns an empty string silently.",
	schema: ScanAgentsSchema,
});
