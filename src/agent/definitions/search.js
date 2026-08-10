import { createAgentDefinition } from "./factory.js";

/**
 * Search agent definition for multi-source search and synthesis.
 */
export const searchAgent = createAgentDefinition(
	"search",
	"SEARCH.md",
	"Specialized agent for multi-source search (web, docs, codebase) with synthesis into structured summaries.",
);
