import { ChatOpenAI } from "@langchain/openai";

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
