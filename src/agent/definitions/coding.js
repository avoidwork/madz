import { createAgentDefinition } from "./factory.js";

/**
 * Coding agent definition for code execution and editing.
 */
export const codingAgent = createAgentDefinition(
	"coding",
	"CODING.md",
	"Specialized agent for code editing, debugging, testing, and implementation tasks.",
);
