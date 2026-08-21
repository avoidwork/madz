import { loadConfig } from "../config/loader.js";

/**
 * Resolve the agent for a skill by checking frontmatter first, then config patterns.
 * Frontmatter `metadata.agent` takes priority over config patterns.
 * @param {string} skillName - The skill name to resolve
 * @param {Object} [config] - Optional config override (defaults to loading from disk)
 * @returns {string} The resolved agent name
 */
export function getAgentForSkill(skillName, config = null) {
	if (!config) {
		config = loadConfig();
	}

	const map = config.skillAgentMap || [];
	for (const entry of map) {
		try {
			const regex = new RegExp(entry.pattern);
			if (regex.test(skillName)) {
				return entry.agent;
			}
		} catch {
			// Invalid regex — skip this entry
			continue;
		}
	}

	// No match — return null (caller should use a default)
	return null;
}
