/**
 * Agent definitions index — re-exports from consolidated config and derives getAllAgents().
 */

import {
	codingAgent,
	searchAgent,
	debugAgent,
	codeReviewAgent,
	researchAgent,
	testingAgent,
	documentationAgent,
	securityAuditAgent,
	performanceAgent,
	textEditorAgent,
	seoAnalystAgent,
	translatorAgent,
} from "../agentDefinitions.js";

export {
	codingAgent,
	searchAgent,
	debugAgent,
	codeReviewAgent,
	researchAgent,
	testingAgent,
	documentationAgent,
	securityAuditAgent,
	performanceAgent,
	textEditorAgent,
	seoAnalystAgent,
	translatorAgent,
};

/**
 * Get all agent definitions, derived from the consolidated config.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
export function getAllAgents() {
	return [
		codingAgent,
		searchAgent,
		debugAgent,
		codeReviewAgent,
		researchAgent,
		testingAgent,
		documentationAgent,
		securityAuditAgent,
		performanceAgent,
		textEditorAgent,
		seoAnalystAgent,
		translatorAgent,
	];
}
