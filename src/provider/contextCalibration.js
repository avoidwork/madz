import { createMiddleware } from "langchain";
import { logger } from "../shared/logger.js";

/**
 * Context-meter calibration.
 *
 * The status-bar meter counts messages with the model tokenizer, but the provider
 * bills (and the summarization trigger measures) the whole request: system prompt,
 * deepagents prompt sections, tool schemas and messages. The difference between
 * the provider's reported `input_tokens` and the tokenizer's count of the same
 * request's messages is the request overhead. It is measured on every real model
 * call, so the meter is `tokenizer(current messages) + overhead` and the only
 * estimated part is the messages added since the last call.
 */

/** Overhead in tokens measured on the latest real model call; null until measured. */
let overhead = null;

/**
 * Record the request overhead measured on a real model call.
 * @param {number} tokens - Provider input tokens minus tokenizer message tokens
 * @returns {void}
 */
export function setContextOverhead(tokens) {
	overhead = Number.isFinite(tokens) ? tokens : null;
}

/**
 * Get the request overhead measured on the latest real model call.
 * @returns {number | null} Overhead in tokens, or null before the first measured call
 */
export function getContextOverhead() {
	return overhead;
}

/**
 * Convert a tokenizer message count into the calibrated context size. Before the
 * first measured call the count is returned unchanged.
 * @param {number} messageTokens - Tokenizer count of the current messages
 * @returns {number} Calibrated context size in tokens (never negative)
 */
export function calibratedContextSize(messageTokens) {
	return Math.max(0, messageTokens + (overhead ?? 0));
}

/**
 * Read the provider-reported prompt tokens from a model response.
 * @param {Object} result - The model response from the wrapped handler
 * @returns {number} Input tokens, or 0 when the response carries no usage
 */
export function readInputTokens(result) {
	// The handler may return an AIMessage directly or a ModelResponse
	// (`{ result: [AIMessage, ...] }`); read usage from whichever is present.
	const last = Array.isArray(result?.result) ? result.result[result.result.length - 1] : undefined;
	const usage =
		result?.usage_metadata ??
		last?.usage_metadata ??
		result?.response_metadata?.usage ??
		last?.response_metadata?.usage;
	const tokens = usage?.input_tokens ?? usage?.prompt_tokens;
	return Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
}

/**
 * Create the middleware that measures the request overhead on every real model
 * call. Register it LAST in `createDeepAgent({ middleware })`: the last entry is
 * innermost, so it sees the request exactly as it is sent (after summarization
 * and truncation) and the raw model response.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.model - Model exposing `getNumTokensFromMessages(messages)`
 * @returns {Object} The middleware
 */
export function createContextCalibrationMiddleware(options = {}) {
	const model = options.model;
	return createMiddleware({
		name: "ContextCalibration",
		async wrapModelCall(request, handler) {
			const result = await handler(request);
			const real = readInputTokens(result);
			if (real > 0 && typeof model?.getNumTokensFromMessages === "function") {
				try {
					const { totalCount } = await model.getNumTokensFromMessages(request.messages ?? []);
					setContextOverhead(real - totalCount);
				} catch (err) {
					logger.warn({ error: err?.message }, "[context] calibration skipped");
				}
			}
			return result;
		},
	});
}
