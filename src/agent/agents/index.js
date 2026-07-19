/**
 * Agent definitions index - exports all subagent definitions.
 */

import { searchAgent } from "./search.js";
import { debugAgent } from "./debug.js";
import { codeReviewAgent } from "./code-review.js";
import { researchAgent } from "./research.js";
import { testingAgent } from "./testing.js";
import { documentationAgent } from "./documentation.js";
import { securityAuditAgent } from "./security-audit.js";
import { performanceAgent } from "./performance.js";

export {
	searchAgent,
	debugAgent,
	codeReviewAgent,
	researchAgent,
	testingAgent,
	documentationAgent,
	securityAuditAgent,
	performanceAgent,
};

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
