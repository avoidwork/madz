import { createMiddleware, countTokensApproximately } from "langchain";
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
 * Estimate the context cost of a conversation: input tokens (system + messages)
 * plus the configured output budget. Shared by the `TokenBudget` middleware and
 * the TUI context counter so both report the same context window. Callable
 * regardless of whether `maxTokensMinute` is configured.
 * @param {Array} conversation - Array of {role, content} messages
 * @param {Object} [options] - Estimation options
 * @param {string} [options.model] - Model name, used for tiktoken encoder resolution
 * @param {string} [options.encoding] - Explicit tiktoken encoding name
 * @param {number} [options.maxTokens] - Output token budget added to the estimate
 * @param {Array} [options.tools] - Tool definitions (StructuredTool[]) included in
 *   the request. Tokenized via `countTokensApproximately`, matching the library's
 *   own serialization of tool schemas into the model request.
 * @returns {Promise<number>} Estimated total token cost
 */
export async function estimateContextCost(
	conversation,
	{ model, encoding, maxTokens, tools } = {},
) {
	const inputTokens = await calculateConversationTokens(conversation, model, encoding);
	let toolTokens = 0;
	if (tools && tools.length > 0) {
		toolTokens = countTokensApproximately([], tools);
	}
	// `-1` means unlimited / no cap — treat it as 0 (no output budget) so the
	// estimate is not off by one.
	const outputBudget = maxTokens === -1 ? 0 : maxTokens || 0;
	return inputTokens + toolTokens + outputBudget;
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
 * @param {Function} [options.onContextWindowExceeded] - Callback invoked when a
 *   400 context-window error is detected. It receives the error and the model
 *   request (so the caller can extract the thread_id). It should compact the
 *   context (e.g. via `agent.compactContext`) so the request can be re-sent once.
 * @returns {Object|null} The middleware, or `null` when the budget is disabled
 */
export function createTokenBudgetMiddleware(options = {}) {
	const maxTokensMinute = options.maxTokensMinute || 0;
	if (maxTokensMinute <= 0) return null;

	const budget = options.budget ?? getSharedTokenBudget(maxTokensMinute);
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const onContextWindowExceeded = options.onContextWindowExceeded;

	/**
	 * Estimate the cost of a model request: input tokens (system + messages)
	 * plus the configured output budget. Delegates to the shared helper so the
	 * middleware and the TUI context counter report the same context window.
	 * @param {Object} request - The `wrapModelCall` request
	 * @returns {Promise<number>} Estimated total token cost
	 */
	async function estimateCost(request) {
		const conversation = toConversation(request.messages, request.systemMessage);
		return estimateContextCost(conversation, {
			model: options.model,
			encoding: options.encoding,
			maxTokens: options.maxTokens,
			tools: request.tools,
		});
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

					// A 400 context-window error means the conversation exceeds the
					// model's context length. Compact the context and re-send once.
					if (isContextWindowError(err)) {
						if (attempt === 0 && typeof onContextWindowExceeded === "function") {
							logger.warn(
								{ message: err?.message },
								"[provider] Context window exceeded; compacting and re-sending",
							);
							await onContextWindowExceeded(err, request);
							// Re-pace before re-dispatching so the retry does not fire
							// while the window is still over capacity.
							await budget.waitForCapacity(estimatedCost);
							continue;
						}
						throw err;
					}

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
	return /context|context length|context window|maximum .* length/i.test(message);
}
