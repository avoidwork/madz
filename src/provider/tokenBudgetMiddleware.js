import { createMiddleware } from "langchain";
import { getSharedTokenBudget, getRetryDelayMs, DEFAULT_RETRY_AFTER_MS } from "./openai.js";
import { calculateConversationTokens } from "../tui/contextTokens.js";
import { logger } from "../shared/logger.js";

/** Number of dispatch-level retries on a 429 when the token budget is enabled. */
const RATE_LIMIT_RETRIES = 1;

/**
 * Extract the actual token usage (prompt + completion) from a dispatch
 * response. Returns the total when present, or 0 when the response carries no
 * usable `usage` field (e.g. some providers or streaming responses).
 * @param {Object} result - The model response from the wrapped handler
 * @returns {number} Actual prompt + completion tokens, or 0 when absent
 */
export function readUsageTokens(result) {
	const usage = result?.usage_metadata ?? result?.usage ?? result?.llmOutput?.usage;
	if (!usage) return 0;
	const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
	const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
	const total = usage.total_tokens ?? prompt + completion;
	return total > 0 ? total : prompt + completion;
}

/**
 * Normalize LangChain messages (and an optional system message) into the
 * `{role, content}` shape expected by `calculateConversationTokens`.
 * Content blocks are flattened to text so multimodal parts do not produce
 * `[object Object]` in the estimate.
 * @param {Array} [messages] - LangChain messages from the model request
 * @param {Object} [systemMessage] - Optional system message from the request
 * @returns {Array} Conversation array of {role, content} with string content
 */
export function toConversation(messages, systemMessage) {
	const msgs = Array.isArray(messages) ? messages : messages ? [messages] : [];
	const conversation = msgs.map((msg) => ({
		role: msg.role || msg._getType?.() || "user",
		content: Array.isArray(msg.content)
			? msg.content.map((block) => block?.text ?? "").join("")
			: (msg.content ?? ""),
	}));
	if (systemMessage) {
		const text = Array.isArray(systemMessage.content)
			? systemMessage.content.map((block) => block?.text ?? "").join("")
			: (systemMessage.content ?? "");
		if (text) conversation.unshift({ role: "system", content: text });
	}
	return conversation;
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
 * @param {string} options.model - Model name, used for tiktoken encoder resolution
 * @param {number} [options.maxTokens] - Output token budget added to the estimate
 * @param {string} [options.encoding] - Explicit tiktoken encoding name
 * @param {Object} [options.budget] - Token budget instance (defaults to the
 *   shared instance for `maxTokensMinute`; injectable for tests)
 * @param {Function} [options.sleep] - Sleep function in ms (injectable for tests)
 * @returns {Object|null} The middleware, or `null` when the budget is disabled
 */
export function createTokenBudgetMiddleware(options = {}) {
	const maxTokensMinute = options.maxTokensMinute || 0;
	if (maxTokensMinute <= 0) return null;

	const budget = options.budget ?? getSharedTokenBudget(maxTokensMinute);
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

	/**
	 * Estimate the cost of a model request: input tokens (system + messages)
	 * plus the configured output budget.
	 * @param {Object} request - The `wrapModelCall` request
	 * @returns {Promise<number>} Estimated total token cost
	 */
	async function estimateCost(request) {
		const conversation = toConversation(request.messages, request.systemMessage);
		const inputTokens = await calculateConversationTokens(
			conversation,
			options.model,
			options.encoding,
		);
		return inputTokens + (options.maxTokens || 0);
	}

	return createMiddleware({
		name: "TokenBudget",
		async wrapModelCall(request, handler) {
			const estimatedCost = await estimateCost(request);

			for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
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

					if (!isRateLimitError(err)) throw err;

					if (budget.current() > maxTokensMinute) {
						logger.warn(
							{ tokens: budget.current(), maxTokensMinute },
							"[provider] Rate-limit error attributed to exceeded token budget",
						);
					}
					// The final attempt has no retry left; surface the error.
					if (attempt === RATE_LIMIT_RETRIES) throw err;

					const delay = getRetryDelayMs(err, DEFAULT_RETRY_AFTER_MS);
					logger.warn({ delayMs: delay }, "[provider] Rate-limit hit; retrying after delay");
					await sleep(delay);
					// Re-pace before re-dispatching so the retry does not fire while the
					// window is still over capacity.
					await budget.waitForCapacity(estimatedCost);
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
