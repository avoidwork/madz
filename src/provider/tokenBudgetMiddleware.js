import { createMiddleware, countTokensApproximately } from "langchain";
import { getSharedTokenBudget, getRetryDelayMs, DEFAULT_RETRY_AFTER_MS } from "./openai.js";
import { logger } from "../shared/logger.js";

/** Number of dispatch-level retries on a 429 when the token budget is enabled. */
const RATE_LIMIT_RETRIES = 1;

/** Number of re-sends after a context-window compaction. */
const CONTEXT_RETRIES = 1;

/** Output tokens reserved when `maxTokens` is unset (undefined / -1). */
const DEFAULT_OUTPUT_RESERVE = 4096;

/**
 * Extract the actual token usage (prompt + completion) from a dispatch
 * response. Returns the total when present, or 0 when the response carries no
 * usable `usage` field (e.g. some providers or streaming responses).
 * @param {Object} result - The model response from the wrapped handler
 * @returns {number} Actual prompt + completion tokens, or 0 when absent
 */
export function readUsageTokens(result) {
	// The handler may return an AIMessage directly or a ModelResponse
	// (`{ result: [AIMessage, ...] }`); read usage from whichever is present.
	const last = Array.isArray(result?.result) ? result.result[result.result.length - 1] : undefined;
	const usage =
		result?.usage_metadata ??
		last?.usage_metadata ??
		result?.usage ??
		result?.llmOutput?.usage ??
		last?.response_metadata?.usage ??
		last?.response_metadata?.tokenUsage;
	if (!usage) return 0;
	const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
	const prompt = num(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens);
	const completion = num(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens);
	const total = num(usage.total_tokens ?? usage.totalTokens);
	return total > 0 ? total : prompt + completion;
}

/**
 * Create the `TokenBudget` middleware that enforces `rateLimit.maxTokensMinute`.
 *
 * Enforcement lives in `wrapModelCall` rather than on the model instance,
 * because `ChatOpenAI.bindTools()` calls `withConfig()`, which constructs a
 * NEW model object — instance-property overrides of `invoke`/`stream` are
 * orphaned and never fire on the agent dispatch path.
 *
 * Register it LAST in `createDeepAgent({ middleware: [...] })`. `AgentNode`
 * composes the chain backwards, so the last entry is innermost: it observes
 * the final post-summarization/post-truncation message set and charges the
 * window from the request that is actually sent.
 *
 * @param {Object} options - Middleware options
 * @param {number} options.maxTokensMinute - Rolling tokens-per-minute budget.
 *   `0` (or absent) disables enforcement and returns `null`.
 * @param {Object} options.model - The model instance, used to estimate token
 *   counts via `model.getNumTokensFromMessages(messages)`.
 * @param {number} [options.maxTokens] - Output token budget added to the estimate
 * @param {Object} [options.budget] - Token budget instance (defaults to the
 *   shared instance for `maxTokensMinute`; injectable for tests)
 * @param {Function} [options.sleep] - Sleep function in ms (injectable for tests)
 * @param {Function} [options.onContextWindowExceeded] - Callback invoked when a
 *   400 context-window error is detected. It receives the error and the model
 *   request (so the caller can extract the thread_id). It should compact the
 *   context (e.g. via `agent.compactContext`) so the request can be re-sent once.
 *   It may return a rebuilt request (with `messages`) to be used for the re-send.
 * @returns {Object|null} The middleware, or `null` when the budget is disabled
 */
export function createTokenBudgetMiddleware(options = {}) {
	const maxTokensMinute = options.maxTokensMinute || 0;
	if (!Number.isFinite(maxTokensMinute) || maxTokensMinute <= 0) return null;

	const budget = options.budget ?? getSharedTokenBudget(maxTokensMinute);
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const onContextWindowExceeded = options.onContextWindowExceeded;
	const model = options.model;

	/**
	 * Estimate the cost of a model request: input tokens (system + messages)
	 * plus the configured output budget. Uses the model's own tokenizer via
	 * `model.getNumTokensFromMessages(messages)` so the estimate matches the
	 * model's actual tokenization.
	 * @param {Object} request - The `wrapModelCall` request
	 * @returns {Promise<number>} Estimated total token cost
	 */
	async function estimateCost(request) {
		const messages = request.messages ?? [];
		let inputTokens = 0;
		try {
			if (model && typeof model.getNumTokensFromMessages === "function") {
				const { totalCount } = await model.getNumTokensFromMessages(messages);
				inputTokens = totalCount;
			} else {
				inputTokens = countTokensApproximately(messages);
			}
		} catch {
			inputTokens = countTokensApproximately(messages);
		}
		let toolTokens = 0;
		if (request.tools && request.tools.length > 0) {
			toolTokens = countTokensApproximately([], request.tools);
		}
		// Unset or `-1` (unlimited) maxTokens still reserves a default output
		// budget so the estimate is not systematically low.
		const unset = options.maxTokens === undefined || options.maxTokens === -1;
		const outputBudget = unset
			? DEFAULT_OUTPUT_RESERVE
			: Number.isFinite(options.maxTokens) && options.maxTokens > 0
				? options.maxTokens
				: 0;
		return inputTokens + toolTokens + outputBudget;
	}

	return createMiddleware({
		name: "TokenBudget",
		async wrapModelCall(request, handler) {
			let estimatedCost = await estimateCost(request);
			let rateRetries = 0;
			let contextRetries = 0;

			for (;;) {
				// Atomically wait for capacity and record the reservation.
				const handle = await budget.reserve(estimatedCost);
				try {
					const result = await handler(request);
					// Reconcile the reserved entry to the actual usage reported by the API.
					const actual = readUsageTokens(result);
					if (actual > 0) budget.reconcile(handle, actual);
					return result;
				} catch (err) {
					// A failed attempt must not consume budget.
					budget.release(handle);

					// A 400 context-window error means the conversation exceeds the
					// model's context length. Compact the context and re-send once.
					if (isContextWindowError(err)) {
						if (
							contextRetries >= CONTEXT_RETRIES ||
							typeof onContextWindowExceeded !== "function"
						) {
							throw err;
						}
						contextRetries++;
						logger.warn(
							{ message: err?.message },
							"[provider] Context window exceeded; compacting and re-sending",
						);
						try {
							const next = await onContextWindowExceeded(err, request);
							// Honor a rebuilt request when the callback returns one.
							if (next && typeof next === "object" && Array.isArray(next.messages)) {
								request = next;
							}
						} catch (cbErr) {
							logger.warn(
								{ error: cbErr?.message },
								"[provider] onContextWindowExceeded callback failed",
							);
							throw err;
						}
						// The compacted request is smaller; re-estimate before re-pacing.
						estimatedCost = await estimateCost(request);
						continue;
					}

					if (!isRateLimitError(err)) throw err;

					if (budget.current() > maxTokensMinute) {
						logger.warn(
							{ tokens: budget.current(), maxTokensMinute },
							"[provider] Rate-limit error attributed to exceeded token budget",
						);
					}
					// The final attempt has no retry left; surface the error.
					if (rateRetries >= RATE_LIMIT_RETRIES) throw err;
					rateRetries++;

					const delay = getRetryDelayMs(err, DEFAULT_RETRY_AFTER_MS);
					logger.warn({ delayMs: delay }, "[provider] Rate-limit hit; retrying after delay");
					await sleep(delay);
				}
			}
		},
	});
}

/**
 * Detect a rate-limit (429) error from an LLM provider.
 * @param {Object} err - The caught error
 * @returns {boolean} True if the error is a 429 rate-limit error
 */
function isRateLimitError(err) {
	return err?.status === 429 || err?.response?.status === 429;
}

/**
 * Detect a 400 context-window error from an LLM provider. Requires both an HTTP
 * status of 400 and a message that references the context window / context
 * length, so non-context 400 errors (e.g. invalid API key) are not compacted.
 * @param {Object} err - The caught error
 * @returns {boolean} True if the error is a 400 context-window error
 */
function isContextWindowError(err) {
	const status = err?.status ?? err?.response?.status;
	if (status !== 400) return false;
	const message = String(err?.message ?? err?.response?.data?.error?.message ?? "");
	return /context_length_exceeded|maximum context length|context (length|window)|exceeds? the (model's )?(maximum )?context|too many tokens|prompt is too long/i.test(
		message,
	);
}
