/**
 * Security audit agent definition for security scanning.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the security audit agent system prompt from disk.
 * @param {string} [baseDir] - Base directory (defaults to process.cwd())
 * @returns {string} System prompt text
 */
function loadSecurityAuditPrompt(baseDir) {
	try {
		const dir = baseDir || process.cwd();
		return readFileSync(join(dir, "prompts", "SECURITY_AUDIT.md"), "utf-8");
	} catch {
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
	systemPrompt: loadSecurityAuditPrompt(),
};
