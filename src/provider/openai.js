import { ChatOpenAI } from "@langchain/openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { calculateConversationTokens } from "../tui/contextTokens.js";
import { createTokenBudget } from "./tokenBudget.js";
import { logger } from "../shared/logger.js";

/** Default retry delay (ms) when a 429 carries no `retry-after` hint. */
export const DEFAULT_RETRY_AFTER_MS = 60_000;

/** Number of dispatch-level retries on a 429 when the token budget is enabled. */
const RATE_LIMIT_RETRIES = 1;

// Module-level shared token budget. Every `createChatModel` call with
// `maxTokensMinute > 0` paces against this single instance so the orchestrator
// and all subagents share one rolling window (not an independent budget each).
// Lazily created and keyed by `maxTokensMinute`; a changed value re-creates it.
let sharedTokenBudget = null;
let sharedTokenBudgetMax = 0;

/**
 * Get (or lazily create) the shared token budget for a given
 * `maxTokensMinute`. All model instances with the same value share one window.
 * @param {number} maxTokensMinute - Rolling tokens-per-minute budget
 * @returns {Object} The shared token budget instance
 */
export function getSharedTokenBudget(maxTokensMinute) {
	if (sharedTokenBudget === null || sharedTokenBudgetMax !== maxTokensMinute) {
		sharedTokenBudget = createTokenBudget(maxTokensMinute);
		sharedTokenBudgetMax = maxTokensMinute;
	}
	return sharedTokenBudget;
}

/**
 * Reset the shared token budget. Exported for tests so a fresh budget is used
 * for subsequent model creation.
 */
export function resetTokenBudget() {
	sharedTokenBudget = null;
	sharedTokenBudgetMax = 0;
}

/**
 * Resolve the retry delay for a rate-limit error.
 * Prefers the `retry-after` header (seconds or HTTP-date) when present;
 * otherwise returns the supplied default.
 * @param {Error} err - The rate-limit error
 * @param {number} defaultMs - Fallback delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
export function getRetryDelayMs(err, defaultMs) {
	const header =
		err?.headers?.["retry-after"] ??
		err?.headers?.["Retry-After"] ??
		err?.response?.headers?.["retry-after"] ??
		err?.response?.headers?.["Retry-After"];
	if (header !== undefined) {
		const seconds = Number(header);
		if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
		const date = Date.parse(header);
		if (!Number.isNaN(date)) {
			const delay = date - Date.now();
			return delay > 0 ? delay : defaultMs;
		}
	}
	return defaultMs;
}

/**
 * Detect a rate-limit (429) error from an LLM provider.
 * @param {Error} err - The caught error
 * @returns {boolean} True if the error is a 429 rate-limit error
 */
function isRateLimitError(err) {
	return err?.status === 429 || err?.response?.status === 429;
}

/**
 * Estimate the token cost of a request: input tokens plus the output budget.
 * @param {Array|Object} messages - LangChain message(s) to be sent
 * @param {ProviderConfig} config - Provider configuration
 * @returns {Promise<number>} Estimated total token cost
 */
async function estimateRequestCost(messages, config) {
	const msgs = Array.isArray(messages) ? messages : [messages];
	const inputTokens = await calculateConversationTokens(msgs, config.model, config.encoding);
	const outputBudget = config.maxTokens || 0;
	return inputTokens + outputBudget;
}

/**
 * Extract the actual token usage (prompt + completion) from a dispatch
 * response. Returns the total when present, or 0 when the response carries no
 * usable `usage` field (e.g. some providers or streaming responses).
 * @param {Object} result - The invoke/stream result from the model
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
 * Configuration for creating an OpenAI-compatible chat model.
 * @typedef {Object} ProviderConfig
 * @property {string} base_url - The base URL of the OpenAI-compatible API
 * @property {string} model - The model name (e.g., "gpt-4o", "llama3.1")
 * @property {Object} credentials - Authentication credentials
 * @property {string} credentials.apiKey - The API key for authentication
 * @property {number} [temperature] - Sampling temperature (0-2)
 * @property {number} [maxTokens] - Maximum output tokens
 * @property {boolean} [streaming] - Enable streaming token output
 * @property {Object} [rateLimit] - Rate limit configuration
 * @property {number} [rateLimit.maxRetries] - Maximum retry attempts (0-10, default: 6)
 * @property {number} [rateLimit.maxConcurrency] - Maximum concurrent requests (1+, optional).
 *   Passed through to `ChatOpenAI`, but NOT used by the dispatch path to gate
 *   concurrent model calls — actual concurrency comes from parallel subagents.
 *   The shared token budget is the enforcement point for the tokens-per-minute ceiling.
 * @property {number} [rateLimit.maxTokensMinute] - Rolling tokens-per-minute budget (non-negative int, default: 0 = disabled)
 */

/**
 * Create a ChatOpenAI model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic.
 * @param {ProviderConfig} config - Provider configuration object
 * @returns {ChatOpenAI} A configured ChatOpenAI instance
 */
export function createChatModel(config) {
	const opts = {
		model: config.model,
		temperature: config.temperature,
		maxTokens: config.maxTokens,
		apiKey: config.credentials.apiKey,
		streaming: config.streaming !== false,
		configuration: {
			baseURL: config.base_url,
		},
	};

	if (config.rateLimit) {
		opts.maxRetries = config.rateLimit.maxRetries;
		if (config.rateLimit.maxConcurrency !== undefined) {
			opts.maxConcurrency = config.rateLimit.maxConcurrency;
		}
	}

	// Pass reasoning configuration (effort) for models that support it (o3, o4-mini, etc.)
	if (config.reasoning) {
		opts.reasoning = {
			effort: config.reasoning.effort,
		};
	}

	const model = new ChatOpenAI(opts);

	// Wire the token-budget throttle into dispatch when maxTokensMinute > 0.
	const maxTokensMinute = config.rateLimit?.maxTokensMinute || 0;
	if (maxTokensMinute > 0) {
		// All model instances (orchestrator + subagents) share one budget window.
		const budget = getSharedTokenBudget(maxTokensMinute);

		/**
		 * Normalize LangChain messages to {role, content} for token estimation.
		 * @param {Array|Object} messages - LangChain message(s)
		 * @returns {Array} Normalized messages
		 */
		const normalizeMessages = (messages) => {
			const msgs = Array.isArray(messages) ? messages : [messages];
			return msgs.map((msg) => ({
				role: msg.role || msg._getType?.() || "user",
				content: Array.isArray(msg.content)
					? msg.content.map((block) => block?.text ?? "").join("")
					: (msg.content ?? ""),
			}));
		};

		/**
		 * Wrap a dispatch method to pace requests against the shared token budget.
		 * Reserves capacity atomically before dispatch, reconciles the reserved
		 * entry to actual usage on success, and releases the reservation on
		 * failure. A 429 releases the failed attempt, re-paces, and retries once.
		 * The raw method is read at call time so tests can swap the underlying
		 * implementation (via `model._rawInvoke` / `model._rawStream`) without
		 * bypassing the wrapper.
		 * @param {Function} raw - Getter returning the current raw dispatch method
		 * @returns {Function} Wrapped method
		 */
		const wrapDispatch = (raw) =>
			async function (...args) {
				const [messages] = args;
				const estimatedCost = await estimateRequestCost(normalizeMessages(messages), config);
				let lastError;
				for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
					// Atomically wait for capacity and record the reservation.
					const handle = await budget.reserve(estimatedCost);
					try {
						const result = await raw().apply(this, args);
						// Reconcile the reserved entry to the actual usage reported by the API.
						const actual = readUsageTokens(result);
						if (actual > 0) budget.reconcile(handle, actual);
						return result;
					} catch (err) {
						lastError = err;
						// A failed attempt must not consume budget.
						budget.release(handle);
						if (isRateLimitError(err) && budget.current() > maxTokensMinute) {
							logger.warn(
								{ tokens: budget.current(), maxTokensMinute },
								"[provider] Rate-limit error attributed to exceeded token budget",
							);
						}
						// Retry a rate-limit error once when the token budget is enabled,
						// honoring `retry-after` or defaulting to 60s.
						if (attempt < RATE_LIMIT_RETRIES && isRateLimitError(err)) {
							const delay = getRetryDelayMs(err, DEFAULT_RETRY_AFTER_MS);
							logger.warn({ delayMs: delay }, "[provider] Rate-limit hit; retrying after delay");
							await new Promise((resolve) => setTimeout(resolve, delay));
							// Re-pace before re-dispatching so the retry does not fire
							// while the window is still over capacity.
							await budget.waitForCapacity(estimatedCost);
							continue;
						}
						throw err;
					}
				}
				throw lastError;
			};

		// Keep the raw methods reachable so the wrapper always calls the
		// current implementation, even after a test (or caller) swaps it.
		model._rawInvoke = model.invoke;
		model._rawStream = model.stream;
		model.invoke = wrapDispatch(() => model._rawInvoke);
		model.stream = wrapDispatch(() => model._rawStream);
	}

	// Monkey-patch AIMessageChunk to expose a .reasoning getter that reads
	// from additional_kwargs.reasoning_content. LangChain stores reasoning
	// content there, but the streaming handler checks chunk.reasoning.
	if (AIMessageChunk.prototype && !("reasoning" in AIMessageChunk.prototype)) {
		Object.defineProperty(AIMessageChunk.prototype, "reasoning", {
			get() {
				return this.additional_kwargs?.reasoning_content;
			},
			enumerable: true,
			configurable: true,
		});
	}

	// Normalize vLLM's 'reasoning' field to OpenAI's 'reasoning_content'
	// LangChain's converter only reads 'reasoning_content', so vLLM's
	// reasoning tokens are silently dropped without this normalization.
	if (model.completions) {
		const origDelta = model.completions._convertCompletionsDeltaToBaseMessageChunk.bind(
			model.completions,
		);
		model.completions._convertCompletionsDeltaToBaseMessageChunk = (
			delta,
			rawResponse,
			defaultRole,
		) => {
			if (delta.reasoning !== undefined && delta.reasoning_content === undefined) {
				delta = { ...delta, reasoning_content: delta.reasoning };
			}
			return origDelta(delta, rawResponse, defaultRole);
		};

		const origMsg = model.completions._convertCompletionsMessageToBaseMessage.bind(
			model.completions,
		);
		model.completions._convertCompletionsMessageToBaseMessage = (message, rawResponse) => {
			if (message.reasoning !== undefined && message.reasoning_content === undefined) {
				message = { ...message, reasoning_content: message.reasoning };
			}
			return origMsg(message, rawResponse);
		};
	}

	return model;
}
