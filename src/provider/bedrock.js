import { ChatBedrockConverse } from "@langchain/aws";
import { getSharedTokenBudget } from "./openai.js";

/**
 * Configuration for creating an AWS Bedrock chat model.
 * @typedef {Object} BedrockProviderConfig
 * @property {string} type - Always "bedrock"
 * @property {string} model - The model ID, cross-region inference profile ID (e.g. "us.anthropic.claude-sonnet-4-6"), or application inference profile ARN
 * @property {string} region - The AWS region (e.g. "us-east-1"); required
 * @property {string} [applicationInferenceProfile] - An application inference profile ARN (alternative to `model`)
 * @property {number} [temperature] - Sampling temperature (0-2)
 * @property {number} [maxTokens] - Maximum output tokens
 * @property {boolean} [streaming] - Enable streaming token output
 * @property {Object} [rateLimit] - Rate limit configuration
 * @property {number} [rateLimit.maxRetries] - Maximum retry attempts (0-10, default: 6), mapped to the SDK client's `maxAttempts`
 * @property {number} [rateLimit.maxConcurrency] - Maximum concurrent requests (1+, optional)
 * @property {number} [rateLimit.maxTokensMinute] - Rolling tokens-per-minute budget (non-negative int, default: 0 = disabled)
 */

/**
 * Resolve the AWS region for Bedrock.
 * Prefers `BEDROCK_AWS_REGION`; falls back to `AWS_REGION`. The `@langchain/aws`
 * library itself falls back to `AWS_DEFAULT_REGION`, but the issue specifies
 * `BEDROCK_AWS_REGION` then `AWS_REGION`, so this is resolved explicitly.
 * @returns {string} The resolved region
 */
export function resolveBedrockRegion() {
	return process.env.BEDROCK_AWS_REGION || process.env.AWS_REGION || "";
}

/**
 * Create a ChatBedrockConverse model instance from provider configuration.
 * Authentication is read from environment variables or the standard AWS
 * credential chain, never from config or logs. Precedence:
 *   1. `AWS_BEARER_TOKEN_BEDROCK` — Bedrock API key (bearer token)
 *   2. `BEDROCK_AWS_ACCESS_KEY_ID` + `BEDROCK_AWS_SECRET_ACCESS_KEY` (+ optional
 *      `BEDROCK_AWS_SESSION_TOKEN`) — static or temporary credentials
 *   3. The default AWS credential provider chain (`AWS_PROFILE`, SSO, IAM role,
 *      ECS/EC2 metadata) — when nothing above is set, explicit `credentials`
 *      are omitted and the AWS SDK resolves them.
 *
 * This is a thin model client factory — it does NOT contain graph or agent logic,
 * and it does NOT enforce `rateLimit.maxTokensMinute` on the returned instance.
 * When `maxTokensMinute > 0` it only ensures the shared token budget exists (so
 * the TUI status bar and the `TokenBudget` middleware observe the same window);
 * enforcement lives in the `TokenBudget` middleware, because `bindTools()`
 * rebuilds the model object and would orphan any `invoke`/`stream` override.
 * @param {BedrockProviderConfig} config - Provider configuration object
 * @returns {ChatBedrockConverse} A configured ChatBedrockConverse instance
 */
export function createBedrockChatModel(config) {
	const region = resolveBedrockRegion();
	if (!region) {
		throw new Error(
			"AWS Bedrock provider requires BEDROCK_AWS_REGION or AWS_REGION to be set in the environment",
		);
	}

	const opts = {
		model: config.model,
		region,
		temperature: config.temperature,
		streaming: config.streaming !== false,
	};

	// `-1` means unlimited / no cap: omit maxTokens so the model uses its own
	// output-token default rather than sending an invalid -1 to the API.
	if (config.maxTokens !== -1) {
		opts.maxTokens = config.maxTokens;
	}

	// An application inference profile ARN is an alternative to a model ID.
	if (config.applicationInferenceProfile) {
		opts.applicationInferenceProfile = config.applicationInferenceProfile;
	}

	// Map `rateLimit.maxRetries` to the AWS SDK client's `maxAttempts`. The
	// `@langchain/aws` library does not surface `maxRetries` on the model; the
	// retry/backoff behavior is configured on the underlying BedrockRuntimeClient.
	if (config.rateLimit?.maxRetries !== undefined) {
		opts.clientOptions = { maxAttempts: config.rateLimit.maxRetries };
	}

	const model = new ChatBedrockConverse(opts);

	// Ensure the shared token budget exists when a budget is configured, so the
	// TokenBudget middleware and the TUI status bar observe the same rolling window.
	// Enforcement is NOT wired here: patching model.invoke/stream is orphaned by
	// ChatBedrockConverse.bindTools() -> withConfig(), which builds a new object.
	const maxTokensMinute = config.rateLimit?.maxTokensMinute || 0;
	if (maxTokensMinute > 0) getSharedTokenBudget(maxTokensMinute);

	return model;
}
