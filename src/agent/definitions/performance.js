import { createAgentDefinition } from "./factory.js";

/**
 * Performance agent definition for performance benchmarking.
 */
export const performanceAgent = createAgentDefinition(
	"performance",
	"PERFORMANCE.md",
	"Specialized agent for performance benchmarking, bottleneck identification, and optimization suggestions.",
);
