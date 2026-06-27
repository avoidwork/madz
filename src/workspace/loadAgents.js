import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { checkFileLimit } from "../tools/common.js";

const cliCwd = process.argv.find((arg) => arg.startsWith("--cwd="))?.split("=")[1];

/**
 * Check if a file path exists.
 * @param {string} filepath - File path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filepath) {
	try {
		await access(filepath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Load AGENTS.md from the current working directory and format it for the system prompt.
 * @param {string} [targetCwd] - Working directory to read AGENTS.md from. Defaults to config.cwd.
 * @param {string} [maxReadSize] - Maximum file size to read (e.g., "1mb")
 * @returns {Promise<string>} Formatted prompt section, or empty string if file not found
 */
export async function loadAgents(targetCwd, maxReadSize) {
	const resolvedCwd = targetCwd || cwd;
	const agentsPath = join(resolvedCwd, "AGENTS.md");

	if (!(await fileExists(agentsPath))) {
		return "";
	}

	if (maxReadSize) {
		const limitCheck = await checkFileLimit(agentsPath, maxReadSize);
		if (!limitCheck.ok) {
			return limitCheck.error;
		}
	}

	const content = await readFile(agentsPath, "utf-8");

	return (
		"## Workspace Rules\n\n" +
		"The following rules are loaded from the workspace `AGENTS.md`. They define project-specific conventions and constraints. Follow them strictly:\n\n" +
		"---\n\n" +
		content.trim()
	);
}		"---\n\n" +
		content.trim()
	);
}