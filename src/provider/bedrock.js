import { ChatBedrockConverse } from "@langchain/aws";

/**
 * Configuration for creating an AWS Bedrock chat model.
 * @typedef {Object} BedrockProviderConfig
 * @property {string} model - The model ID, cross-region inference profile ID (`us.` prefix),
 *   or application inference profile ARN
 * @property {string} region - The AWS region (e.g., "us-east-1")
 * @property {string} [applicationInferenceProfile] - An application inference profile ARN
 * @property {number} [temperature] - Sampling temperature (0-2)
 * @property {number} [maxTokens] - Maximum output tokens (-1 = unlimited)
 * @property {number} [contextWindow] - The model context window length
 * @property {Object} [rateLimit] - Rate limit configuration
 * @property {number} [rateLimit.maxRetries] - Maximum retry attempts (0-10, default: 6)
 * @property {number} [rateLimit.maxConcurrency] - Maximum concurrent requests (optional)
 * @property {number} [rateLimit.maxTokensMinute] - Rolling tokens-per-minute budget (default: 0 = disabled)
 */

/**
 * Resolve the AWS region for the Bedrock client.
 * Prefers `BEDROCK_AWS_REGION`, falling back to `AWS_REGION`.
 * @returns {string} The resolved region
 * @throws {Error} If no region is configured
 */
export function resolveRegion() {
	const region = process.env.BEDROCK_AWS_REGION || process.env.AWS_REGION;
	if (!region) {
		throw new Error("Bedrock region is required. Set BEDROCK_AWS_REGION or AWS_REGION.");
	}
	return region;
}

/**
 * Resolve the Bedrock authentication options in precedence order:
 * 1. `AWS_BEARER_TOKEN_BEDROCK` — Bedrock API key (bearer token)
 * 2. `BEDROCK_AWS_ACCESS_KEY_ID` + `BEDROCK_AWS_SECRET_ACCESS_KEY` (+ optional
 *    `BEDROCK_AWS_SESSION_TOKEN`) — static or temporary credentials
 * 3. The default AWS credential provider chain — omit explicit credentials and
 *    let the AWS SDK resolve them (AWS_PROFILE, SSO, IAM role, ECS/EC2 metadata)
 * @returns {Object} The resolved auth options for `ChatBedrockConverse`
 */
export function resolveAuth() {
	const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
	if (bearerToken) {
		return { bedrockBearerToken: bearerToken };
	}

	const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
	if (accessKeyId && secretAccessKey) {
		const auth = {
			bedrockApiKey: accessKeyId,
			bedrockApiSecret: secretAccessKey,
		};
		const sessionToken = process.env.BEDROCK_AWS_SESSION_TOKEN;
		if (sessionToken) {
			auth.bedrockApiSessionToken = sessionToken;
		}
		return auth;
	}

	// Default AWS credential provider chain. Omit explicit credentials so the
	// AWS SDK resolves them (AWS_PROFILE, SSO, IAM role, ECS/EC2 metadata).
	return {};
}

/**
 * Create a ChatBedrockConverse model instance from provider configuration.
 * This is a thin model client factory — it does NOT contain graph or agent logic.
 * Auth is resolved from environment variables or the default AWS credential
 * chain, never from config files.
 * @param {BedrockProviderConfig} config - Provider configuration object
 * @returns {ChatBedrockConverse} A configured ChatBedrockConverse instance
 */
export function createBedrockModel(config) {
	const region = resolveRegion();
	const auth = resolveAuth();

	const opts = {
		model: config.model,
		region,
		temperature: config.temperature,
		streaming: config.streaming !== false,
		...auth,
	};

	// Allow injecting a custom BedrockRuntimeClient (used by tests to mock the
	// Converse API) and forwarding clientOptions.
	if (config.client) {
		opts.client = config.client;
	}
	if (config.clientOptions) {
		opts.clientOptions = config.clientOptions;
	}

	// `-1` means unlimited / no cap: omit maxTokens so the model uses its own
	// output-token default rather than sending an invalid -1 to the API.
	if (config.maxTokens !== -1) {
		opts.maxTokens = config.maxTokens;
	}

	// Support an application inference profile ARN as the model target.
	if (config.applicationInferenceProfile) {
		opts.applicationInferenceProfile = config.applicationInferenceProfile;
	}

	// Map `rateLimit.maxRetries` to the SDK client's `maxAttempts` so Bedrock
	// throttling (ThrottlingException) is retried with backoff.
	if (config.rateLimit) {
		opts.maxRetries = config.rateLimit.maxRetries;
		opts.clientOptions = {
			...opts.clientOptions,
			maxAttempts: config.rateLimit.maxRetries,
		};
	}

	return new ChatBedrockConverse(opts);
}
