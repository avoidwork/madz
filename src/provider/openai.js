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
 */

/**
 * Create a ChatOpenAI model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic.
 * In spawned subAgent processes, the SUBAGENT_TEMPERATURE env var overrides
 * the config temperature.
 * @param {ProviderConfig} config - Provider configuration object
 * @returns {ChatOpenAI} A configured ChatOpenAI instance
 */
export function createChatModel(config) {
	let temperature = config.temperature;

	// Allow spawned subAgent processes to override temperature via env var
	const envTemperature = process.env.SUBAGENT_TEMPERATURE;
	if (envTemperature !== undefined && envTemperature !== "") {
		const parsed = Number(envTemperature);
		if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
			temperature = parsed;
		}
	}

	return new ChatOpenAI({
		model: config.model,
		temperature,
		maxTokens: config.maxTokens,
		apiKey: config.credentials.apiKey,
		streaming: config.streaming !== false,
		configuration: {
			baseURL: config.base_url,
		},
	});
}
