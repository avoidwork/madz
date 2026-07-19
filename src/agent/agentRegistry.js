/**
 * Agent registry for managing subagent definitions.
 * Provides addAgent, getAgent, listAgents, and validateAgent functions.
 */

/**
 * Agent registry class for managing subagent definitions.
 */
export class AgentRegistry {
	constructor() {
		this.agents = new Map();
	}

	/**
	 * Add an agent definition to the registry.
	 * @param {Object} agent - Agent definition object
	 * @param {string} agent.name - Unique agent name
	 * @param {string} agent.description - Agent description
	 * @param {string} agent.systemPrompt - System prompt for the agent
	 * @param {Object} agent.model - Chat model instance
	 * @param {string[]} [agent.tools] - Array of tool names for this agent
	 * @returns {AgentRegistry} This registry instance
	 */
	addAgent(agent) {
		if (!agent.name || !agent.systemPrompt) {
			throw new Error("Agent must have name and systemPrompt");
		}

		if (this.agents.has(agent.name)) {
			throw new Error(`Agent "${agent.name}" already exists`);
		}

		this.agents.set(agent.name, {
			name: agent.name,
			description: agent.description || "",
			systemPrompt: agent.systemPrompt,
			model: agent.model,
			tools: agent.tools || [],
		});

		return this;
	}

	/**
	 * Get an agent by name.
	 * @param {string} name - Agent name
	 * @returns {Object|null} Agent definition or null if not found
	 */
	getAgent(name) {
		return this.agents.get(name) || null;
	}

	/**
	 * List all agent names in the registry.
	 * @returns {string[]} Array of agent names
	 */
	listAgents() {
		return Array.from(this.agents.keys());
	}

	/**
	 * Validate an agent definition before adding.
	 * @param {Object} agent - Agent definition to validate
	 * @returns {Object} Validation result with isValid and errors
	 */
	validateAgent(agent) {
		const errors = [];

		if (!agent.name) {
			errors.push("Agent must have a name");
		} else if (typeof agent.name !== "string" || agent.name.length === 0) {
			errors.push("Agent name must be a non-empty string");
		}

		if (!agent.systemPrompt) {
			errors.push("Agent must have a systemPrompt");
		} else if (typeof agent.systemPrompt !== "string") {
			errors.push("Agent systemPrompt must be a string");
		}

		if (agent.model && typeof agent.model !== "object") {
			errors.push("Agent model must be an object");
		}

		if (agent.tools && !Array.isArray(agent.tools)) {
			errors.push("Agent tools must be an array");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Clear all agents from the registry.
	 * @returns {AgentRegistry} This registry instance
	 */
	clear() {
		this.agents.clear();
		return this;
	}
}
