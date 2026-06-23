import { ChatOpenAI } from "@langchain/openai";

/**
 * Parse and validate subAgent temperature from environment variable.
 * @param {string} envValue - The MADZ_SUBAGENT_TEMPERATURE env var value
 * @param {number} providerDefault - The provider's default temperature
 * @returns {number} Validated temperature value
 */
function parseSubAgentTemperature(envValue, providerDefault) {
	if (envValue === undefined || envValue === "") {
		return providerDefault;
	}

	const parsed = parseFloat(envValue);
	if (isNaN(parsed) || parsed < 0 || parsed > 2) {
		return providerDefault;
	}

	return parsed;
}

/**
 * Create a ChatOpenAI model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic.
 * @param {ProviderConfig} config - Provider configuration object
 * @returns {ChatOpenAI} A configured ChatOpenAI instance
 */
export function createChatModel(config) {
	// Check for subAgent temperature override from spawned process env var
	const subAgentTemp = parseSubAgentTemperature(
		process.env.MADZ_SUBAGENT_TEMPERATURE,
		config.temperature,
	);

	return new ChatOpenAI({
		model: config.model,
		temperature: subAgentTemp,
		maxTokens: config.maxTokens,
		apiKey: config.credentials.apiKey,
		streaming: config.streaming !== false,
		configuration: {
			baseURL: config.base_url,
		},
	});
}
