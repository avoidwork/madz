import { ChatOpenAI } from "@langchain/openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { createTokenBudget } from "./tokenBudget.js";

/** Default retry delay (ms) when a 429 carries no `retry-after` hint. */
export const DEFAULT_RETRY_AFTER_MS = 60_000;

// Module-level shared token budget. Every `createChatModel` call with
// `maxTokensMinute > 0` paces against this single instance so the orchestrator
// and all subagents share one rolling window (not an independent budget each).
// Lazily created and keyed by `maxTokensMinute`; a changed value re-creates it.
// Enforcement happens in the `TokenBudget` middleware
// (`src/provider/tokenBudgetMiddleware.js`), which reads this same instance —
// NOT by patching the returned model's `invoke`/`stream`, which `bindTools()`
// would orphan.
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
 * @property {number} [rateLimit.maxTokensMinute] - Rolling tokens-per-minute budget (non-negative int, default: 0 = disabled).
 *   Enforced by the `TokenBudget` middleware (`src/provider/tokenBudgetMiddleware.js`) registered on
 *   `createDeepAgent`, NOT by this model instance — `createChatModel` deliberately does not patch
 *   `invoke`/`stream`, because `ChatOpenAI.bindTools()` constructs a new object and orphans such patches.
 */

/**
 * Create a ChatOpenAI model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic,
 * and it does NOT enforce `rateLimit.maxTokensMinute` on the returned instance.
 * When `maxTokensMinute > 0` it only ensures the shared token budget exists (so
 * the TUI status bar and the `TokenBudget` middleware observe the same window);
 * enforcement lives in the `TokenBudget` middleware, because `bindTools()`
 * rebuilds the model object and would orphan any `invoke`/`stream` override.
 * @param {ProviderConfig} config - Provider configuration object
 * @returns {ChatOpenAI} A configured ChatOpenAI instance
 */
/**
 * Get the active provider configuration from a config object.
 * The active provider is the first key in `config.providers`, falling back to
 * `openai` when no provider is configured. Shared between the orchestrator and
 * the TUI status bar so the selection rule is not duplicated.
 * @param {Object} config - The loaded config object
 * @returns {Object} The active provider config, or an empty object
 */
export function getActiveProviderConfig(config) {
	const providerName = Object.keys(config?.providers || {})[0] || "openai";
	return config?.providers?.[providerName] || {};
}

/**
 * Get the active provider's model name from a config object.
 * @param {Object} config - The loaded config object
 * @returns {string} The active model name, or empty string if none is configured
 */
export function getActiveModelName(config) {
	return getActiveProviderConfig(config).model || "";
}

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

	// Ensure the shared token budget exists when a budget is configured, so the
	// TokenBudget middleware and the TUI status bar observe the same rolling window.
	// Enforcement is NOT wired here: patching model.invoke/stream is orphaned by
	// ChatOpenAI.bindTools() -> withConfig(), which builds a new object. See
	// src/provider/tokenBudgetMiddleware.js.
	const maxTokensMinute = config.rateLimit?.maxTokensMinute || 0;
	if (maxTokensMinute > 0) getSharedTokenBudget(maxTokensMinute);

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
