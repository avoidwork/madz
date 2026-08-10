import { createAgentDefinition } from "./factory.js";

/**
 * Debug agent definition for error tracing and fix proposals.
 */
export const debugAgent = createAgentDefinition(
	"debug",
	"DEBUG.md",
	"Specialized agent for error tracing, reproduction, and fix proposals with dedicated context.",
);
