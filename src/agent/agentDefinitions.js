/**
 * Consolidated agent definitions — data-driven configuration.
 * Each entry maps an agent name to its prompt file and description.
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../shared/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "..", "prompts");

/**
 * Agent configuration entries.
 * @type {{ name: string, promptFile: string, description: string }[]}
 */
export const AGENT_CONFIGS = [
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

	readFile(join(PROMPTS_DIR, promptFile), "utf-8")
		.then((prompt) => {
			agent.systemPrompt = prompt;
		})
		.catch((err) => {
			logger.debug(`[${name}] Failed to load prompt: ${err.message}`);
		});

	return agent;
}

/**
 * Cached agent definitions loaded at module init.
 * @type {{ name: string, description: string, systemPrompt: string }[]}
 */
const agents = AGENT_CONFIGS.map((cfg) =>
	createAgentDefinition(cfg.name, cfg.promptFile, cfg.description),
);

// Wait for all prompts to load before exporting.
await Promise.all(
	AGENT_CONFIGS.map((cfg) =>
		readFile(join(PROMPTS_DIR, cfg.promptFile), "utf-8")
			.then((prompt) => {
				logger.debug(`[${cfg.name}] Prompt loaded (${prompt.length} chars)`);
			})
			.catch((err) => {
				logger.debug(`[${cfg.name}] Failed to load prompt: ${err.message}`);
			}),
	),
);

/**
 * Build all agent definitions from the consolidated config.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
function buildAllAgents() {
	return agents;
}

/**
 * Get all agent definitions.
 * @returns {{ name: string, description: string, systemPrompt: string }[]}
 */
export function getAllAgents() {
	return buildAllAgents();
}
