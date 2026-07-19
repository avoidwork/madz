/**
 * Agent definitions index - exports all subagent definitions.
 */

export { searchAgent } from "./search.js";
export { debugAgent } from "./debug.js";
export { codeReviewAgent } from "./code-review.js";
export { researchAgent } from "./research.js";
export { testingAgent } from "./testing.js";
export { documentationAgent } from "./documentation.js";
export { securityAuditAgent } from "./security-audit.js";
export { performanceAgent } from "./performance.js";

/**
 * Get all agent definitions.
 * @returns {Object[]} Array of agent definition objects
 */
export function getAllAgents() {
	return [
		searchAgent,
		debugAgent,
		codeReviewAgent,
		researchAgent,
		testingAgent,
		documentationAgent,
		securityAuditAgent,
		performanceAgent,
	];
}
