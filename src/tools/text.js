import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const MAX_INPUT_LENGTH = 10000;

/**
 * Zod schema for the text processing tool input.
 */
const TextSchema = z.object({
	action: z
		.enum(["summarize", "rewrite", "tone", "grammar", "shorten", "expand"])
		.describe("The text processing action to perform"),
	input: z
		.string()
		.min(1, "Input text is required")
		.max(MAX_INPUT_LENGTH, `Input must not exceed ${MAX_INPUT_LENGTH} characters`),
	options: z
		.object({
			tone: z
				.string()
				.optional()
				.describe("Target tone for rewrite/tone actions (e.g., 'professional', 'casual')"),
			targetLength: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Target character length for shorten/expand actions"),
			language: z
				.string()
				.optional()
				.describe("Language code for the input text (e.g., 'en', 'fr')"),
		})
		.optional()
		.describe("Optional parameters for the action"),
});

/**
 * Build the system prompt for a given text processing action.
 * @param {string} action - The action type
 * @param {object} options - Action options
 * @returns {string} System prompt for the LLM
 */
function buildSystemPrompt(action, options = {}) {
	const prompts = {
		summarize:
			"You are a professional summarizer. Produce a concise summary of the provided text that captures all key points. Return structured JSON with fields: result (the summary string), action ('summarize'), and metadata (object with inputLength, outputLength, language).",
		rewrite: `You are a professional editor. Rewrite the provided text according to the specified tone (${options.tone || "same"}). Preserve the original meaning and key information. Return structured JSON with fields: result (the rewritten text), action ('rewrite'), and metadata (object with originalLength, outputLength, tone).`,
		tone: `You are a tone adjustment specialist. Rewrite the provided text to match the specified tone (${options.tone || "professional"}). Preserve all factual content. Return structured JSON with fields: result (the tone-adjusted text), action ('tone'), and metadata (object with originalLength, outputLength, targetTone).`,
		grammar:
			"You are a grammar correction specialist. Fix all grammatical, spelling, and punctuation errors in the provided text while preserving the original meaning and style. Return structured JSON with fields: result (the corrected text), action ('grammar'), and metadata (object with originalLength, outputLength, correctionsCount).",
		shorten: `You are a text editor. Condense the provided text to approximately ${options.targetLength || 100} characters while preserving the core message. Return structured JSON with fields: result (the shortened text), action ('shorten'), and metadata (object with originalLength, outputLength).`,
		expand: `You are a text editor. Expand the provided text to approximately ${options.targetLength || 500} characters by adding relevant detail and elaboration while preserving the core message. Return structured JSON with fields: result (the expanded text), action ('expand'), and metadata (object with originalLength, outputLength).`,
	};
	return prompts[action] || prompts.summarize;
}

/**
 * Core text processing logic.
 * @param {z.infer<typeof TextSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @returns {Promise<string>} JSON result string
 */
export async function textImpl(input, options = {}) {
	const { action, input: text, options: actionOptions } = input;

	if (!text || typeof text !== "string" || text.trim().length === 0) {
		return JSON.stringify({
			ok: false,
			error: "Input text is required and must be a non-empty string",
		});
	}

	if (text.length > MAX_INPUT_LENGTH) {
		return JSON.stringify({
			ok: false,
			error: `Input must not exceed ${MAX_INPUT_LENGTH} characters`,
		});
	}

	const apiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return JSON.stringify({ ok: false, error: "OPENAI_API_KEY is required for text processing" });
	}

	const llm = new ChatOpenAI({
		model: "gpt-4o",
		apiKey,
		temperature: 0.3,
		maxTokens: 4096,
	});

	const systemPrompt = buildSystemPrompt(action, actionOptions || {});

	try {
		const response = await llm.invoke([
			{ role: "system", content: systemPrompt },
			{ role: "user", content: text },
		]);

		let result;
		try {
			result = JSON.parse(response.content);
		} catch {
			// Fallback: wrap the raw response in structured format
			result = {
				result: typeof response.content === "string" ? response.content : String(response.content),
				action,
				metadata: {
					inputLength: text.length,
					outputLength: typeof response.content === "string" ? response.content.length : 0,
				},
			};
		}

		return JSON.stringify({ ok: true, ...result });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Text processing failed: ${err.message}` });
	}
}

/**
 * LangChain tool wrapper for text processing.
 */
export const text = tool(textImpl, {
	name: "text",
	description:
		"Process text: summarize, rewrite, adjust tone, correct grammar, shorten, or expand. Returns structured JSON output.",
	schema: TextSchema,
});
