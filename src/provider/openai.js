import { ChatOpenAI } from "@langchain/openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { calculateConversationTokens } from "../tui/contextTokens.js";
import { createTokenBudget } from "./tokenBudget.js";
import { logger } from "../shared/logger.js";

/** Default retry delay (ms) when a 429 carries no `retry-after` hint. */
export const DEFAULT_RETRY_AFTER_MS = 60_000;

/** Number of dispatch-level retries on a 429 when the token budget is enabled. */
const RATE_LIMIT_RETRIES = 1;

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
 * @property {number} [rateLimit.maxConcurrency] - Maximum concurrent requests (1+, optional)
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
		const budget = createTokenBudget(maxTokensMinute);

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
		 * Wrap a dispatch method to pace requests against the token budget.
		 * @param {Function} method - Original invoke/stream method
		 * @returns {Function} Wrapped method
		 */
		const wrapDispatch = (method) =>
			async function (...args) {
				const [messages] = args;
				const estimatedCost = await estimateRequestCost(normalizeMessages(messages), config);
				await budget.waitForCapacity(estimatedCost);
				budget.consume(estimatedCost);
				let lastError;
				for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
					try {
						return await method.apply(this, args);
					} catch (err) {
						lastError = err;
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
							continue;
						}
						throw err;
					}
				}
				throw lastError;
			};

		model.invoke = wrapDispatch(model.invoke);
		model.stream = wrapDispatch(model.stream);
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
