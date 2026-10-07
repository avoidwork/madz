import { ChatOpenAI } from "@langchain/openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { createTokenBudget } from "./tokenBudget.js";
import { createCopilotFetch, base } from "./copilotAuth.js";

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
export function createChatModel(config) {
	const isCopilot = config.type === "github-copilot";
	const opts = {
		model: config.model,
		temperature: config.temperature,
		streaming: config.streaming !== false,
		configuration: {
			baseURL: config.base_url,
		},
	};

	// GitHub Copilot authenticates via OAuth device flow, not a static apiKey.
	// Inject the bearer token on every request through a custom fetch interceptor
	// that reads the token fresh from the auth file. This survives bindTools()
	// and picks up a re-auth without rebuilding the model.
	// For GHEC (enterpriseUrl), derive the API base from the enterprise host
	// rather than the public default, so model calls hit the right endpoint.
	if (isCopilot) {
		opts.configuration.baseURL = config.enterpriseUrl
			? base(config.enterpriseUrl)
			: config.base_url;
		opts.configuration.fetch = createCopilotFetch();
		// The OpenAI SDK v7 client constructor throws `Missing credentials`
		// when no apiKey/workloadIdentity/adminAPIKey is present, even when a
		// custom fetch is supplied. Pass a non-empty placeholder so the
		// credential check passes; the custom fetch interceptor overrides the
		// Authorization header with the real bearer token on every request, so
		// this placeholder is never sent to the API.
		opts.apiKey = "copilot";
	} else {
		opts.apiKey = config.credentials.apiKey;
	}

	// `-1` means unlimited / no cap: omit maxTokens so the model uses its own
	// output-token default rather than sending an invalid -1 to the API.
	if (config.maxTokens !== -1) {
		opts.maxTokens = config.maxTokens;
	}

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

/**
 * Resolve the effective Copilot model name against the tenant's available
 * models. Enterprise/GHE Copilot deployments expose a tenant-specific model
 * list at `GET {base}/models`; the configured `model` may be a generic alias
 * (e.g. "gpt-4o") that must be mapped to a tenant model that is actually
 * available and pickable.
 *
 * This is best-effort and never throws: on any failure (network error,
 * non-200, empty list, model not found) it returns the configured model string
 * unchanged so the caller falls back gracefully.
 * @param {Object} config - The provider configuration
 * @param {string} config.model - The configured model name
 * @param {string} [config.enterpriseUrl] - The enterprise/GHE URL
 * @param {string} [config.base_url] - The provider base URL
 * @returns {Promise<string>} The resolved model name (configured string on failure)
 */
export async function resolveCopilotModel(config = {}) {
	const model = config.model;
	if (!model) return model;

	const baseUrl = config.enterpriseUrl ? base(config.enterpriseUrl) : config.base_url;
	if (!baseUrl) return model;

	try {
		const res = await fetch(`${baseUrl}/models`, {
			headers: { Accept: "application/json" },
		});
		if (!res.ok) return model;
		const data = await res.json();
		const models = Array.isArray(data) ? data : data?.data;
		if (!Array.isArray(models) || models.length === 0) return model;

		// Prefer a tenant model that is pickable (model_picker_enabled), matching
		// opencode's model discovery. Fall back to any model whose id matches the
		// configured name.
		const pickable = models.find((m) => m?.model_picker_enabled === true && m?.id === model);
		if (pickable?.id) return pickable.id;

		const exact = models.find((m) => m?.id === model);
		if (exact?.id) return exact.id;

		return model;
	} catch {
		return model;
	}
}
