/**
 * Consolidated agent definitions — data-driven configuration.
 * Each entry maps an agent name to its prompt file and description.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../shared/logger.js";

/**
 * Agent configuration entries.
 * @type {{ name: string, promptFile: string, description: string }[]}
 */
const AGENT_CONFIGS = [
	{
		name: "coding",
		promptFile: "CODING.md",
		description:
			"Specialized agent for code editing, debugging, testing, and implementation tasks.",
	},
	{
		name: "search",
		promptFile: "SEARCH.md",
		description:
			"Specialized agent for multi-source search (web, docs, codebase) with synthesis into structured summaries.",
	},
	{
		name: "debug",
		promptFile: "DEBUG.md",
		description:
			"Specialized agent for error tracing, reproduction, and fix proposals with dedicated context.",
	},
	{
		name: "code-review",
		promptFile: "CODE_REVIEW.md",
		description:
			"Specialized agent for structured code reviews covering bugs, security, style, and performance.",
	},
	{
		name: "research",
		promptFile: "RESEARCH.md",
		description:
			"Specialized agent for multi-step research with source tracking and comprehensive reports.",
	},
	{
		name: "testing",
		promptFile: "TESTING.md",
		description: "Specialized agent for test generation, gap analysis, and coverage improvements.",
	},
	{
		name: "documentation",
		promptFile: "DOCUMENTATION.md",
		description:
			"Specialized agent for documentation updates, API docs generation, and changelog maintenance.",
	},
	{
		name: "security-audit",
		promptFile: "SECURITY_AUDIT.md",
		description:
			"Specialized agent for security scanning, dependency auditing, and vulnerability detection.",
	},
	{
		name: "performance",
		promptFile: "PERFORMANCE.md",
		description:
			"Specialized agent for performance benchmarking, bottleneck identification, and optimization suggestions.",
	},
	{
		name: "textEditor",
		promptFile: "TEXT_EDITOR.md",
		description:
			"Specialized agent for text processing — summarize, rewrite, tone adjustment, grammar correction, shorten, and expand.",
	},
	{
		name: "seoAnalyst",
		promptFile: "SEO_ANALYST.md",
		description:
			"Specialized agent for SEO analysis — keyword density, meta description generation, SERP analysis, and content optimization.",
	},
	{
		name: "translator",
		promptFile: "TRANSLATOR.md",
		description: "Specialized agent for multi-language translation and language detection.",
	},
];

/**
 * Create an agent definition with an async-loaded system prompt.
 * @param {string} name - Agent name identifier
 * @param {string} promptFile - Prompt filename (e.g., "CODING.md")
 * @param {string} description - Agent description
 * @returns {{ name: string, description: string, systemPrompt: string }}
 */
function createAgentDefinition(name, promptFile, description) {
	const agent = {
		name,
		description,
		systemPrompt: "",
	};

	readFile(join(process.cwd(), "prompts", promptFile), "utf-8")
		.then((prompt) => {
			agent.systemPrompt = prompt;
		})
		.catch((err) => {
			logger.debug(`[${name}] Failed to load prompt: ${err.message}`);
		});

	return agent;
}

/**
 * Build all agent definitions from the consolidated config.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
function buildAllAgents() {
	return AGENT_CONFIGS.map((cfg) =>
		createAgentDefinition(cfg.name, cfg.promptFile, cfg.description),
	);
}

/**
 * Get all agent definitions.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
export function getAllAgents() {
	return buildAllAgents();
}

// Individual named exports for backward compatibility.
export const codingAgent = createAgentDefinition(
	"coding",
	"CODING.md",
	AGENT_CONFIGS[0].description,
);
export const searchAgent = createAgentDefinition(
	"search",
	"SEARCH.md",
	AGENT_CONFIGS[1].description,
);
export const debugAgent = createAgentDefinition("debug", "DEBUG.md", AGENT_CONFIGS[2].description);
export const codeReviewAgent = createAgentDefinition(
	"code-review",
	"CODE_REVIEW.md",
	AGENT_CONFIGS[3].description,
);
export const researchAgent = createAgentDefinition(
	"research",
	"RESEARCH.md",
	AGENT_CONFIGS[4].description,
);
export const testingAgent = createAgentDefinition(
	"testing",
	"TESTING.md",
	AGENT_CONFIGS[5].description,
);
export const documentationAgent = createAgentDefinition(
	"documentation",
	"DOCUMENTATION.md",
	AGENT_CONFIGS[6].description,
);
export const securityAuditAgent = createAgentDefinition(
	"security-audit",
	"SECURITY_AUDIT.md",
	AGENT_CONFIGS[7].description,
);
export const performanceAgent = createAgentDefinition(
	"performance",
	"PERFORMANCE.md",
	AGENT_CONFIGS[8].description,
);
export const textEditorAgent = createAgentDefinition(
	"textEditor",
	"TEXT_EDITOR.md",
	AGENT_CONFIGS[9].description,
);
export const seoAnalystAgent = createAgentDefinition(
	"seoAnalyst",
	"SEO_ANALYST.md",
	AGENT_CONFIGS[10].description,
);
export const translatorAgent = createAgentDefinition(
	"translator",
	"TRANSLATOR.md",
	AGENT_CONFIGS[11].description,
);
