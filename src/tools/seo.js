import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const MAX_INPUT_LENGTH = 10000;

/**
 * Zod schema for the SEO analysis tool input.
 */
const SeoSchema = z.object({
	action: z
		.enum(["keyword-density", "meta-description", "serp-analysis", "optimize"])
		.describe("The SEO analysis action to perform"),
	input: z
		.string()
		.min(1, "Input text is required")
		.max(MAX_INPUT_LENGTH, `Input must not exceed ${MAX_INPUT_LENGTH} characters`),
	keywords: z.array(z.string()).optional().describe("Target keywords for analysis"),
	options: z
		.object({
			targetKeywords: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Target number of keywords for density analysis"),
			includeSuggestions: z
				.boolean()
				.optional()
				.describe("Whether to include optimization suggestions"),
			targetKeyword: z.string().optional().describe("Primary target keyword for meta description"),
		})
		.optional()
		.describe("Optional parameters for the action"),
});

/**
 * Calculate keyword density using string matching.
 * @param {string} text - The input text
 * @param {string} keyword - The keyword to analyze
 * @returns {{ density: number, count: number, occurrences: number }}
 */
function calculateKeywordDensity(text, keyword) {
	const lowerText = text.toLowerCase();
	const lowerKeyword = keyword.toLowerCase();
	const wordCount = lowerText.split(/\s+/).filter((w) => w.length > 0).length;

	if (wordCount === 0 || lowerKeyword.length === 0) {
		return { density: 0, count: 0, occurrences: 0 };
	}

	let count = 0;
	let pos = 0;
	while ((pos = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
		count++;
		pos += lowerKeyword.length;
	}

	return {
		density: wordCount > 0 ? (count / wordCount) * 100 : 0,
		count,
		occurrences: count,
	};
}

/**
 * Build the system prompt for a given SEO action.
 * @param {string} action - The action type
 * @param {object} options - Action options
 * @returns {string} System prompt for the LLM
 */
function buildSystemPrompt(action, options = {}) {
	const prompts = {
		"keyword-density": `You are an SEO analyst. Analyze the keyword density of the provided text. For each target keyword, calculate the density (percentage of total words). Return structured JSON with fields: result (object mapping each keyword to its density, count, and occurrences), action ('keyword-density'), and metadata (object with totalWords, inputLength). If no keywords provided, analyze the most frequent words.`,
		"meta-description": `You are an SEO specialist. Generate a meta description for the provided text. The description must be 160 characters or fewer, include the target keyword (${options.targetKeyword || "the primary keyword"}), and be compelling for click-through. Return structured JSON with fields: result (the meta description string), action ('meta-description'), and metadata (object with length, keywordIncluded).`,
		"serp-analysis": `You are an SEO analyst. Analyze the provided text for SERP optimization. Consider keyword usage, content structure, readability, and competitive positioning. Return structured JSON with fields: result (object with analysis), action ('serp-analysis'), and metadata (object with inputLength).`,
		optimize: `You are an SEO specialist. Optimize the provided text for search engines. Improve keyword usage, meta elements, readability, and structure. Return structured JSON with fields: result (the optimized text), action ('optimize'), and metadata (object with originalLength, outputLength, suggestions).`,
	};
	return prompts[action] || prompts["keyword-density"];
}

/**
 * Core SEO analysis logic.
 * @param {z.infer<typeof SeoSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.openaiApiKey] - OpenAI API key (overrides config)
 * @returns {Promise<string>} JSON result string
 */
export async function seoImpl(input, options = {}) {
	const { action, input: text, keywords, options: actionOptions } = input;

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
		return JSON.stringify({ ok: false, error: "OPENAI_API_KEY is required for SEO analysis" });
	}

	// Handle keyword-density action locally (no LLM needed)
	if (action === "keyword-density") {
		const targetKeywords = keywords || [];
		const results = {};

		if (targetKeywords.length > 0) {
			for (const keyword of targetKeywords) {
				results[keyword] = calculateKeywordDensity(text, keyword);
			}
		} else {
			// Analyze most frequent words
			const words = text
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 2);
			const freq = {};
			for (const word of words) {
				freq[word] = (freq[word] || 0) + 1;
			}
			const sorted = Object.entries(freq)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10);
			for (const [word, count] of sorted) {
				const density = (count / words.length) * 100;
				freq[word] = { density, count, occurrences: count };
			}
			Object.assign(results, freq);
		}

		return JSON.stringify({
			ok: true,
			result: results,
			action,
			metadata: {
				totalWords: text.split(/\s+/).filter((w) => w.length > 0).length,
				inputLength: text.length,
			},
		});
	}

	// For other actions, use LLM
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
			result = {
				result: typeof response.content === "string" ? response.content : String(response.content),
				action,
				metadata: { inputLength: text.length },
			};
		}

		return JSON.stringify({ ok: true, ...result });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `SEO analysis failed: ${err.message}` });
	}
}

/**
 * LangChain tool wrapper for SEO analysis.
 */
export const seo = tool(seoImpl, {
	name: "seo",
	description:
		"Analyze SEO metrics: keyword density, meta description generation, SERP analysis, content optimization. Returns structured JSON output.",
	schema: SeoSchema,
});
