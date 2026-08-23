import { createAgentDefinition } from "./factory.js";

/**
 * SEO analyst agent definition for keyword analysis, meta descriptions, and SERP optimization.
 */
export const seoAnalystAgent = createAgentDefinition(
	"seoAnalyst",
	"SEO_ANALYST.md",
	"Specialized agent for SEO analysis — keyword density, meta description generation, SERP analysis, and content optimization.",
);
