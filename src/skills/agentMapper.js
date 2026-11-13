import { loadConfig } from "../config/loader.js";
import { logger } from "../shared/logger.js";

/**
 * Resolve the agent for a skill from the `skillAgentMap` config patterns.
 * (A frontmatter `metadata.agent` is honored by the caller before this is consulted.)
 * Each pattern is compiled at most once per call; invalid patterns are logged and skipped.
 * @param {string} skillName - The skill name to resolve
 * @param {Object} [config] - Optional config override (defaults to loading from disk)
 * @returns {string | null} The resolved agent name, or null when no pattern matches
 */
export function getAgentForSkill(skillName, config = null) {
	if (!config) {
		config = loadConfig();
	}

	const map = config.skillAgentMap || [];
	for (const entry of map) {
		try {
			if (new RegExp(entry.pattern).test(skillName)) {
				return entry.agent;
			}
		} catch (err) {
			logger.warn(
				`[agentMapper] Ignoring invalid skillAgentMap pattern "${entry.pattern}": ${err.message}`,
			);
		}
	}

	// No match — return null (caller should use a default)
	return null;
}
