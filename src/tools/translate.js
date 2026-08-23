import { tool } from "@langchain/core/tools";
import { z } from "zod";
import translate from "google-translate-api";
import { lru } from "tiny-lru";

const MAX_INPUT_LENGTH = 10000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const RATE_LIMIT_MAX_REQUESTS = 10;

// Translation result cache
const translationCache = lru(1000, CACHE_TTL_MS, true);

// Rate limiter state
let requestTimestamps = [];

/**
 * Check and enforce rate limiting.
 * @returns {Promise<void>}
 */
async function enforceRateLimit() {
	const now = Date.now();
	requestTimestamps = requestTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

	if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
		const oldest = requestTimestamps[0];
		const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldest) + 10;
		await new Promise((resolve) => setTimeout(resolve, waitTime));
	}

	requestTimestamps.push(Date.now());
}

/**
 * Zod schema for the translation tool input.
 */
const TranslateSchema = z.object({
	action: z.enum(["translate", "detect"]).describe("The translation action to perform"),
	input: z
		.string()
		.min(1, "Input text is required")
		.max(MAX_INPUT_LENGTH, `Input must not exceed ${MAX_INPUT_LENGTH} characters`),
	targetLanguage: z
		.string()
		.optional()
		.describe("Target language code (e.g., 'fr', 'de', 'ja'). Required for 'translate' action."),
	sourceLanguage: z
		.string()
		.optional()
		.describe("Source language code (e.g., 'en', 'fr'). Auto-detected if omitted."),
});

/**
 * Core translation logic.
 * @param {z.infer<typeof TranslateSchema>} input - Tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {string} [options.apiKey] - Google Translate API key (overrides env)
 * @returns {Promise<string>} JSON result string
 */
export async function translateImpl(input, options = {}) {
	const { action, input: text, targetLanguage, sourceLanguage } = input;

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

	if (action === "translate" && !targetLanguage) {
		return JSON.stringify({
			ok: false,
			error: "targetLanguage is required for the 'translate' action",
		});
	}

	// Handle language detection locally (no API key needed)
	if (action === "detect") {
		try {
			await enforceRateLimit();
			const result = await translate(text, { from: sourceLanguage || "auto", to: "en" });
			const detectedLang = result.from?.autoTranslated
				? "auto-detected"
				: result.from?.language?.isoCode || "unknown";
			return JSON.stringify({
				ok: true,
				result: { language: detectedLang, isTranslation: result.from?.autoTranslated || false },
				action,
				metadata: { inputLength: text.length },
			});
		} catch (err) {
			return JSON.stringify({ ok: false, error: `Language detection failed: ${err.message}` });
		}
	}

	// Translation requires API key
	const apiKey = options.apiKey || process.env.GOOGLE_TRANSLATE_API_KEY;
	if (!apiKey) {
		return JSON.stringify({
			ok: false,
			error: "GOOGLE_TRANSLATE_API_KEY is required for translation",
		});
	}

	// Check cache
	const cacheKey = `${text}:${sourceLanguage || "auto"}:${targetLanguage}`;
	const cached = translationCache.get(cacheKey);
	if (cached) {
		return JSON.stringify({
			ok: true,
			result: { translatedText: cached },
			action,
			metadata: { cached: true, inputLength: text.length },
		});
	}

	try {
		await enforceRateLimit();

		const result = await translate(text, {
			from: sourceLanguage || "auto",
			to: targetLanguage,
			apiKey,
		});

		const translatedText = result.text || "";

		// Cache the result
		translationCache.set(cacheKey, translatedText);

		return JSON.stringify({
			ok: true,
			result: { translatedText },
			action,
			metadata: {
				inputLength: text.length,
				outputLength: translatedText.length,
				sourceLanguage: result.from?.language?.isoCode || sourceLanguage || "auto",
				targetLanguage,
				cached: false,
			},
		});
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
		"Translate text between languages or detect the source language. Requires GOOGLE_TRANSLATE_API_KEY. Supports caching and rate limiting.",
	schema: TranslateSchema,
});
