import { AzureChatOpenAI } from "@langchain/openai";
import { getSharedTokenBudget } from "./openai.js";

/**
 * Configuration for creating an Azure OpenAI chat model.
 * @typedef {Object} AzureProviderConfig
 * @property {string} type - Always "azure-openai"
 * @property {string} model - The deployment name (acts as the model)
 * @property {string} [endpoint] - The Azure OpenAI endpoint (e.g. https://<resource>.openai.azure.com)
 * @property {string} [apiVersion] - The Azure OpenAI API version (e.g. 2024-10-21)
 * @property {number} [temperature] - Sampling temperature (0-2)
 * @property {number} [maxTokens] - Maximum output tokens
 * @property {boolean} [streaming] - Enable streaming token output
 * @property {Object} [rateLimit] - Rate limit configuration
 * @property {number} [rateLimit.maxRetries] - Maximum retry attempts (0-10, default: 6)
 * @property {number} [rateLimit.maxConcurrency] - Maximum concurrent requests (1+, optional)
 * @property {number} [rateLimit.maxTokensMinute] - Rolling tokens-per-minute budget (non-negative int, default: 0 = disabled)
 * @property {Object} [reasoning] - Reasoning configuration (effort)
 */

/**
 * Resolve the Azure OpenAI endpoint from the environment.
 * Prefers `AZURE_OPENAI_ENDPOINT`; otherwise derives `https://<instance>.openai.azure.com`
 * from `AZURE_OPENAI_API_INSTANCE_NAME`.
 * @returns {string} The resolved endpoint
 */
export function resolveAzureEndpoint() {
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
	if (endpoint) return endpoint.replace(/\/+$/, "");
	const instance = process.env.AZURE_OPENAI_API_INSTANCE_NAME;
	if (instance) return `https://${instance}.openai.azure.com`;
	return "";
}

/**
 * Create an AzureChatOpenAI model instance from provider configuration.
 * Authentication is read exclusively from environment variables (`AZURE_OPENAI_*`),
 * never from config or logs. Throws a clear error naming any missing required variable.
 *
 * This is a thin model client factory — it does NOT contain graph or agent logic,
 * and it does NOT enforce `rateLimit.maxTokensMinute` on the returned instance.
 * When `maxTokensMinute > 0` it only ensures the shared token budget exists (so
 * the TUI status bar and the `TokenBudget` middleware observe the same window);
 * enforcement lives in the `TokenBudget` middleware, because `bindTools()`
 * rebuilds the model object and would orphan any `invoke`/`stream` override.
 * @param {AzureProviderConfig} config - Provider configuration object
 * @returns {AzureChatOpenAI} A configured AzureChatOpenAI instance
 */
export function createAzureChatModel(config) {
	const apiKey = process.env.AZURE_OPENAI_API_KEY;
	const endpoint = resolveAzureEndpoint();
	const deploymentName = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME || config.model;
	const apiVersion = process.env.AZURE_OPENAI_API_VERSION || config.apiVersion;

	if (!apiKey) {
		throw new Error(
			"Azure OpenAI provider requires AZURE_OPENAI_API_KEY to be set in the environment",
		);
	}
	if (!endpoint) {
		throw new Error(
			"Azure OpenAI provider requires AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_INSTANCE_NAME to be set in the environment",
		);
	}
	if (!deploymentName) {
		throw new Error(
			"Azure OpenAI provider requires AZURE_OPENAI_API_DEPLOYMENT_NAME to be set in the environment",
		);
	}

	const opts = {
		azureOpenAIApiKey: apiKey,
		azureOpenAIEndpoint: endpoint,
		azureOpenAIApiDeploymentName: deploymentName,
		azureOpenAIApiVersion: apiVersion,
		temperature: config.temperature,
		streaming: config.streaming !== false,
	};

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

	// Pass reasoning configuration (effort) for models that support it.
	if (config.reasoning) {
		opts.reasoning = {
			effort: config.reasoning.effort,
		};
	}

	const model = new AzureChatOpenAI(opts);

	// Ensure the shared token budget exists when a budget is configured, so the
	// TokenBudget middleware and the TUI status bar observe the same rolling window.
	// Enforcement is NOT wired here: patching model.invoke/stream is orphaned by
	// AzureChatOpenAI.bindTools() -> withConfig(), which builds a new object.
	const maxTokensMinute = config.rateLimit?.maxTokensMinute || 0;
	if (maxTokensMinute > 0) getSharedTokenBudget(maxTokensMinute);

	return model;
}
