import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const MAX_INPUT_LENGTH = 10000;

/**
 * Zod schema for the translation tool input.
 */
const TranslateSchema = z.object({
	action: z.enum(["translate", "detect"]).describe("The translation action to perform"),
	input: z.string().min(1, "Input text is required").max(MAX_INPUT_LENGTH, `Input must not exceed ${MAX_INPUT_LENGTH} characters`),
	targetLanguage: z.string().optional().describe("Target language code (e.g., 'fr', 'de', 'ja'). Required for 'translate' action."),
	sourceLanguage: z.string().optional().describe("Source language code (e.g., 'en', 'fr'). Auto-detected if omitted."),
});

/**
 * Build the system prompt for a given translation action.
 * @param {string} action - The action type
 * @param {object} options - Action options
 * @returns {string} System prompt for the LLM
 */
function buildSystemPrompt(action, options = {}) {
	if (action === "translate") {
		return `You are a professional translator. Translate the provided text to ${options.targetLanguage || "the target language"} while preserving the original meaning, tone, and context. Return structured JSON with fields: result (the translated text), action ('translate'), and metadata (object with inputLength, outputLength, sourceLanguage, targetLanguage).`;
	}
	// detect
	return `You are a language detection specialist. Analyze the provided text and identify its language. Return structured JSON with fields: result (object with language code like 'en', 'fr', 'de', etc.), action ('detect'), and metadata (object with inputLength, confidence).`;
}

/**
 * Core translation logic.
 * @param {z.infer<typeof TranslateSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @returns {Promise<string>} JSON result string
 */
export async function translateImpl(input, options = {}) {
	const { action, input: text, targetLanguage } = input;

	if (!text || typeof text !== "string" || text.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Input text is required and must be a non-empty string" });
	}

	if (text.length > MAX_INPUT_LENGTH) {
		return JSON.stringify({ ok: false, error: `Input must not exceed ${MAX_INPUT_LENGTH} characters` });
	}

	if (action === "translate" && !targetLanguage) {
		return JSON.stringify({ ok: false, error: "targetLanguage is required for the 'translate' action" });
	}

	const apiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return JSON.stringify({ ok: false, error: "OPENAI_API_KEY is required for translation" });
	}

	const llm = new ChatOpenAI({
		model: "gpt-4o",
		apiKey,
		temperature: 0.3,
		maxTokens: 4096,
	});

	const systemPrompt = buildSystemPrompt(action, { targetLanguage });

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
				metadata: { inputLength: text.length },
			};
		}

		return JSON.stringify({ ok: true, ...result });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Translation failed: ${err.message}` });
	}
}

/**
 * LangChain tool wrapper for translation.
 */
export const translateTool = tool(translateImpl, {
	name: "translate",
	description:
		"Translate text between languages or detect the source language. Returns structured JSON output.",
	schema: TranslateSchema,
});