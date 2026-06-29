import { DEFAULT_METADATA, isValidMetadata } from "./categories.js";
import { createClassificationPrompt, createRewritingPrompt } from "./prompts.js";
import { logger } from "../../logger.js";

/**
 * Classify a user prompt into structured metadata (intent, domain, complexity).
 * Uses the configured LLM model to analyze the prompt and return classification results.
 * Falls back to default metadata if the LLM call fails or returns invalid results.
 *
 * @param {import("@langchain/core/language_models/chat_models").ChatLanguageModel} model - The chat model to use for classification
 * @param {string} userPrompt - The raw user prompt to classify
 * @returns {Promise<{ intent: string; domain: string; complexity: string }>} Classification metadata, or default metadata on failure
 */
export async function classifyPrompt(model, userPrompt) {
	try {
		const prompt = createClassificationPrompt(userPrompt);
		const response = await model.invoke(prompt);
		const content =
			typeof response.content === "string" ? response.content : JSON.stringify(response.content);

		// Extract JSON from the response (handle markdown code blocks)
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return DEFAULT_METADATA;
		}

		const metadata = JSON.parse(jsonMatch[0]);

		// Validate the parsed metadata
		if (isValidMetadata(metadata)) {
			return metadata;
		}

		// If parsed but invalid, return defaults
		return DEFAULT_METADATA;
	} catch {
		// LLM call failed — return default metadata
		return DEFAULT_METADATA;
	}
}

/**
 * Rewrite a user prompt into an optimized, structured format using classification metadata.
 * Uses the configured LLM model to rewrite the prompt, informed by the classification results.
 * Falls back to the original prompt if the LLM call fails.
 *
 * @param {import("@langchain/core/language_models/chat_models").ChatLanguageModel} model - The chat model to use for rewriting
 * @param {string} userPrompt - The original user prompt
 * @param {{ intent: string; domain: string; complexity: string }} metadata - Classification metadata
 * @returns {Promise<string>} The rewritten prompt, or the original prompt on failure
 */
export async function rewritePrompt(model, userPrompt, metadata) {
	try {
		const prompt = createRewritingPrompt(userPrompt, metadata);
		const response = await model.invoke(prompt);
		const content =
			typeof response.content === "string" ? response.content : JSON.stringify(response.content);

		// Extract content from markdown code blocks if present
		const codeBlockMatch = content.match(/```[\s\S]*?\n?([\s\S]*?)```/);
		if (codeBlockMatch) {
			return codeBlockMatch[1].trim();
		}

		// Return the cleaned response text (strip any remaining markdown formatting)
		return content.replace(/```[\s\S]*?```/g, "").trim();
	} catch {
		// LLM call failed — return original prompt
		return userPrompt;
	}
}

/**
 * Process a user prompt through the full classification + rewriting pipeline.
 * First classifies the prompt, then rewrites it using the classification metadata.
 * Handles cascading failures: if classification fails, uses default metadata for rewriting.
 * If rewriting fails, returns the original prompt.
 *
 * @param {import("@langchain/core/language_models/chat_models").ChatLanguageModel} model - The chat model to use for both classification and rewriting
 * @param {string} userPrompt - The raw user prompt to process
 * @returns {Promise<{ rewrittenPrompt: string; metadata: { intent: string; domain: string; complexity: string } }>} The rewritten prompt and classification metadata
 */
export async function processPrompt(model, userPrompt) {
	logger.info({ userPrompt }, "promptPipeline: start");

	// Stage 1: Classify
	const metadata = await classifyPrompt(model, userPrompt);
	logger.info({ metadata }, "promptPipeline: classified");

	// Stage 2: Rewrite (using classification metadata, even if it's default)
	const rewrittenPrompt = await rewritePrompt(model, userPrompt, metadata);
	logger.info({ rewrittenPrompt }, "promptPipeline: rewritten");

	return {
		rewrittenPrompt,
		metadata,
	};
}
