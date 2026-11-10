import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { validatePath } from "../common.js";
import { AGENTS_FILE_NAMES, readAgentsFile } from "../../workspace/loadAgents.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const DEFAULT_MAX_READ_SIZE = "1mb";

const AgentsSchema = z.object({
	path: z
		.string()
		.min(1)
		.max(4096)
		.optional()
		.describe(
			"Directory to look in for AGENTS.md, or the path of an AGENTS.md file (defaults to the current working directory)",
		),
});

/**
 * Core agents logic: validate the path, then read AGENTS.md from that directory only
 * (no parent-directory search). Returns the raw file contents.
 * @param {z.infer<typeof AgentsSchema>} input - The tool input
 * @param {object} [options] - Runtime options (allowedPaths, maxReadSize). May be a
 *   LangChain RunnableConfig or undefined, in which case live config values are used.
 * @returns {Promise<{ ok: boolean, agents?: string, error?: string }>} Structured result
 */
export async function agentsImpl(input, options) {
	const opts = options || {};
	const config = loadConfig();
	const targetPath = input?.path || getProjectCwd() || config.cwd || process.cwd();
	// The orchestrator invokes the raw singleton without runtime options, so fall back to
	// the live config. loadConfig() is cached, so this reflects app mutations.
	const allowedPaths = opts.allowedPaths || config.sandbox?.paths || [];
	const maxReadSize = opts.maxReadSize || config.sandbox?.maxReadSize || DEFAULT_MAX_READ_SIZE;

	const resolved = validatePath(targetPath, allowedPaths);
	if (!resolved.allowed) {
		return { ok: false, error: resolved.error };
	}

	// Determine the candidate file(s): either the given AGENTS.md file or names in a directory.
	let candidates;
	try {
		const st = await stat(resolved.realPath || resolved.path);
		if (st.isDirectory()) {
			candidates = AGENTS_FILE_NAMES.map((name) => join(resolved.path, name));
		} else if (AGENTS_FILE_NAMES.includes(basename(resolved.path))) {
			candidates = [resolved.path];
		} else {
			return {
				ok: false,
				error: `Not a directory or an AGENTS.md file: ${targetPath}`,
			};
		}
	} catch (err) {
		if (err.code === "ENOENT" || err.code === "ENOTDIR") {
			return { ok: true, agents: "" };
		}
		return { ok: false, error: `Cannot access ${targetPath}: ${err.message}` };
	}

	for (const candidate of candidates) {
		// Validate the file itself so an AGENTS.md symlink cannot escape the sandbox,
		// and read from the resolved real path.
		const file = validatePath(candidate, allowedPaths);
		if (!file.allowed) {
			return { ok: false, error: file.error };
		}
		const result = await readAgentsFile(file.realPath || file.path, maxReadSize);
		if (!result.ok) {
			return { ok: false, error: result.error };
		}
		if (result.found) {
			return { ok: true, agents: result.content.trim() };
		}
	}
	return { ok: true, agents: "" };
}

/**
 * agents tool — singleton export.
 */
export const agents = tool(agentsImpl, {
	name: "agents",
	description:
		"Look for AGENTS.md in a directory (the current project directory by default, or a given path) and return its raw contents as { ok, agents }. Only that directory is checked, not its parents. If no AGENTS.md exists, agents is an empty string. Returns an error if the path is outside the sandbox or the file is unreadable or too large.",
	schema: AgentsSchema,
});
