import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";

/**
 * Create an agent definition with an async-loaded system prompt.
 * @param {string} name - Agent name identifier
 * @param {string} promptFile - Prompt filename (e.g., "CODING.md")
 * @param {string} description - Agent description
 * @returns {{ name: string, description: string, systemPrompt: string }}
 */
export function createAgentDefinition(name, promptFile, description) {
	const agent = {
		name,
		description,
		systemPrompt: "",
	};

	readFile(join(process.cwd(), "prompts", promptFile), "utf-8")
		.then((prompt) => {
			agent.systemPrompt = prompt;
		})
		.catch((err) => {
			logger.debug(`[${name}] Failed to load prompt: ${err.message}`);
		});

	return agent;
}
