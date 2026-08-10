import { createAgentDefinition } from "./factory.js";

/**
 * Documentation agent definition for documentation updates.
 */
export const documentationAgent = createAgentDefinition(
	"documentation",
	"DOCUMENTATION.md",
	"Specialized agent for documentation updates, API docs generation, and changelog maintenance.",
);
