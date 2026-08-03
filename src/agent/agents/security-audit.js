/**
 * Security audit agent definition for security scanning.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../logger.js";

/**
 * Load the security audit agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {Promise<string>} System prompt text
 */
async function loadSecurityAuditPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return await readFile(join(dir, "prompts", "SECURITY_AUDIT.md"), "utf-8");
	} catch (err) {
		logger.debug(`[security-audit] Failed to load prompt: ${err.message}`);
		return "";
	}
}

/**
 * Security audit agent definition.
 * @type {Object}
 */
export const securityAuditAgent = {
	name: "security-audit",
	description:
		"Specialized agent for security scanning, dependency auditing, and vulnerability detection.",
	systemPrompt: "",
};

loadSecurityAuditPrompt().then((prompt) => {
	securityAuditAgent.systemPrompt = prompt;
});
