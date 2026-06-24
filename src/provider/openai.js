import { ChatOpenAI } from "@langchain/openai";

/**
 * Create a ChatOpenAI model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic.
 * @param {ProviderConfig} config - Provider configuration object
 * @returns {ChatOpenAI} A configured ChatOpenAI instance
 */
export function createChatModel(config) {
	return new ChatOpenAI({
		model: config.model,
		temperature: config.temperature,
		maxTokens: config.maxTokens,
		apiKey: config.credentials.apiKey,
		streaming: config.streaming !== false,
		configuration: {
			baseURL: config.base_url,
		},
	});
}