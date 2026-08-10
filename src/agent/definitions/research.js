import { createAgentDefinition } from "./factory.js";

/**
 * Research agent definition for multi-step research.
 */
export const researchAgent = createAgentDefinition(
	"research",
	"RESEARCH.md",
	"Specialized agent for multi-step research with source tracking and comprehensive reports.",
);
