/**
 * Agent definitions index — re-exports from consolidated config and derives getAllAgents().
 */

import { getAllAgents, AGENT_CONFIGS } from "../agentDefinitions.js";

export { getAllAgents };

/**
 * Get all agent definitions, derived from the consolidated config.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
export function getAgentByName(name) {
	return getAllAgents().find((agent) => agent.name === name);
}

/**
 * Map of agent name → agent definition for keyed access.
 * @type {Record<string, { name: string, description: string, systemPrompt: string }>}
 */
export const agents = Object.fromEntries(
	AGENT_CONFIGS.map((cfg) => [cfg.name, cfg]),
);
