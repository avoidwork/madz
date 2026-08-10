import { createAgentDefinition } from "./factory.js";

/**
 * Testing agent definition for test generation and gap analysis.
 */
export const testingAgent = createAgentDefinition(
	"testing",
	"TESTING.md",
	"Specialized agent for test generation, gap analysis, and coverage improvements.",
);
