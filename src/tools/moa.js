import { tool } from "@langchain/core/tools";
import { z } from "zod";

const NUM_REFERENCES = 4;
const CALL_TIMEOUT_MS = 60000; // 60 seconds per call
const REFERENCE_PROMPTS = [
	"Provide a detailed, factual analysis of the following topic. Focus on key points, evidence, and logical reasoning.",
	"Answer from a practical, experience-based perspective. What would someone with hands-on experience say?",
	"Approach from a creative, divergent-thinking angle. Include unconventional ideas and alternative viewpoints.",
	"Take a cautious, risk-aware approach. Highlight potential issues, limitations, and counterarguments.",
];

/**
 * Call OpenRouter for a model reference response.
 * @param {string} apiKey - OpenRouter API key
 * @param {string} referencePrompt - The reference prompt to use
 * @param {string} userMessage - The user's original message
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{ ok: boolean, response?: string, model?: string, error?: string }>}
 */
async function callOpenRouter(apiKey, referencePrompt, userMessage, timeoutMs) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://madz.io",
				"X-Title": "madz",
			},
			body: JSON.stringify({
				model: "openai/gpt-4o",
				messages: [
					{ role: "system", content: referencePrompt },
					{ role: "user", content: userMessage },
				],
				max_tokens: 2048,
				temperature: 0.7,
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `OpenRouter error (${resp.status}): ${text.slice(0, 200)}` };
		}

		const data = await resp.json();
		const choice = data.choices?.[0];
		return {
			ok: !!choice,
			response: choice?.message?.content || "",
			model: data.model || "",
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `OpenRouter request failed: ${err.message}` };
	}
}

/**
 * Aggregate multiple agent responses into a single answer.
 * @param {string[]} responses - Array of agent responses
 * @param {string} userMessage - Original user message
 * @returns {string} Aggregated response
 */
function aggregateResponses(responses, userMessage) {
	const combined = responses
		.map((r, i) => [`Agent ${i + 1}:`, r])
		.flat()
		.join("\n\n---\n\n");
	return [
		"Based on multiple expert analyses, here is a comprehensive answer:",
		"",
		combined,
		"",
		"### Synthesis",
		"",
		`The following answer synthesizes the perspectives above on the topic: "${userMessage}". Each agent brought a unique angle — factual analysis, practical experience, creative thinking, and risk awareness. The synthesized answer below integrates these viewpoints into a coherent response.`,
	].join("\n");
}

/**
 * Execute mixture of agents: 4 parallel OpenRouter calls + 1 aggregation.
 * @param {object} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {Promise<string>} JSON result string
 */
export async function mixtureOfAgentsImpl(input, options) {
	const { message, models } = input;

	if (!message || typeof message !== "string" || message.trim().length === 0) {
		return JSON.stringify({
			ok: false,
			error: "Message is required and must be a non-empty string",
		});
	}

	const apiKey = options?.openrouterApiKey;
	if (!apiKey) {
		return JSON.stringify({
			ok: false,
			error: "OPENROUTER_API_KEY is required for mixture of agents",
		});
	}

	const modelList = models || [
		"openai/gpt-4o",
		"anthropic/claude-3.5-sonnet",
		"google/gemini-pro",
		"meta-llama/llama-3.1-70b",
	];

	if (modelList.length < NUM_REFERENCES) {
		return JSON.stringify({
			ok: false,
			error: `At least ${NUM_REFERENCES} models are required for MoA`,
		});
	}

	// Phase 1: Parallel reference calls
	const referencePromises = REFERENCE_PROMPTS.map((refPrompt, i) =>
		callOpenRouter(apiKey, refPrompt, message, CALL_TIMEOUT_MS).then((result) => ({
			index: i,
			...result,
		})),
	);

	const referenceResults = await Promise.all(referencePromises);
	const successful = referenceResults.filter((r) => r.ok);
	const failed = referenceResults.filter((r) => !r.ok);

	if (successful.length === 0) {
		const errors = failed.map((r) => r.error).join("; ");
		return JSON.stringify({
			ok: false,
			error: `All ${failed.length} model calls failed: ${errors}`,
		});
	}

	// Phase 2: Aggregate responses
	const responses = successful.map((r) => r.response);
	const aggregated = aggregateResponses(responses, message);

	return JSON.stringify({
		ok: true,
		agreement: successful.length === referenceResults.length,
		agentsUsed: successful.length,
		agentsFailed: failed.length,
		failedAgents: failed.map((r) => r.error),
		aggregation: aggregated,
	});
}

/**
 * @param {z.infer<typeof MoaSchema>} input
 * @param {object} _options - Runtime options
 * @returns {string}
 */
export const mixture_of_agents = tool(mixtureOfAgentsImpl, {
	name: "mixtureOfAgents",
	description:
		"Run a mixture of agents (MoA) with 4 parallel reference calls via OpenRouter followed by aggregation. Uses OpenAI GPT-4o references with different perspectives. WARNING: Each call costs ~$0.02-$0.10+ per call. Requires OPENROUTER_API_KEY environment variable. Each call has a 60 second timeout; partial results are aggregated when some calls fail.",
	schema: z.object({
		message: z.string().min(1).describe("Question or topic for the agents to analyze"),
		models: z
			.array(z.string())
			.optional()
			.describe(
				"List of OpenRouter model IDs to use (default: gpt-4o, claude-3.5-sonnet, gemini-pro, llama-3.1-70b)",
			),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a mixture_of_agents tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createMoaTool(options) {
	return tool((input) => mixtureOfAgentsImpl(input, options), {
		name: "mixtureOfAgents",
		description: "Run a mixture of agents (MoA) with 4 parallel reference calls via OpenRouter.",
		schema: z.object({
			message: z.string().min(1).describe("Question or topic for the agents to analyze"),
			models: z.array(z.string()).optional().describe("List of OpenRouter model IDs to use"),
		}),
	});
}
