import { createAgentDefinition } from "./factory.js";

/**
 * Code review agent definition for structured code reviews.
 */
export const codeReviewAgent = createAgentDefinition(
	"code-review",
	"CODE_REVIEW.md",
	"Specialized agent for structured code reviews covering bugs, security, style, and performance.",
);
