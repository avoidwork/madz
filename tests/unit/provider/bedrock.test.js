import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createBedrockChatModel, resolveBedrockRegion } from "../../../src/provider/bedrock.js";
import { BedrockProviderConfigSchema } from "../../../src/config/schemas/providers.js";

const BEDROCK_ENV_KEYS = [
	"BEDROCK_AWS_REGION",
	"AWS_REGION",
	"AWS_BEARER_TOKEN_BEDROCK",
	"BEDROCK_AWS_ACCESS_KEY_ID",
	"BEDROCK_AWS_SECRET_ACCESS_KEY",
	"BEDROCK_AWS_SESSION_TOKEN",
];

function clearBedrockEnv() {
	for (const key of BEDROCK_ENV_KEYS) {
		delete process.env[key];
	}
}

function setBedrockEnv(overrides = {}) {
	clearBedrockEnv();
	process.env.BEDROCK_AWS_REGION = overrides.BEDROCK_AWS_REGION ?? "us-east-1";
	process.env.BEDROCK_AWS_ACCESS_KEY_ID = overrides.BEDROCK_AWS_ACCESS_KEY_ID ?? "test-access-key";
	process.env.BEDROCK_AWS_SECRET_ACCESS_KEY =
		overrides.BEDROCK_AWS_SECRET_ACCESS_KEY ?? "test-secret-key";
	if (overrides.BEDROCK_AWS_SESSION_TOKEN) {
		process.env.BEDROCK_AWS_SESSION_TOKEN = overrides.BEDROCK_AWS_SESSION_TOKEN;
	}
}

describe("BedrockProviderConfigSchema", () => {
	it("accepts a valid bedrock config", () => {
		const result = BedrockProviderConfigSchema.parse({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			enabled: true,
			temperature: 0.4,
			maxTokens: -1,
			contextWindow: 200000,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(result.type, "bedrock");
		assert.strictEqual(result.model, "us.anthropic.claude-sonnet-4-6");
		assert.strictEqual(result.region, "us-east-1");
		assert.strictEqual(result.enabled, true);
	});

	it("defaults type to bedrock", () => {
		const result = BedrockProviderConfigSchema.parse({
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
		});
		assert.strictEqual(result.type, "bedrock");
	});

	it("defaults enabled to true", () => {
		const result = BedrockProviderConfigSchema.parse({
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
		});
		assert.strictEqual(result.enabled, true);
	});

	it("rejects a missing model", () => {
		assert.throws(() =>
			BedrockProviderConfigSchema.parse({ type: "bedrock", region: "us-east-1" }),
		);
	});

	it("rejects a missing region", () => {
		assert.throws(() =>
			BedrockProviderConfigSchema.parse({
				type: "bedrock",
				model: "us.anthropic.claude-sonnet-4-6",
			}),
		);
	});

	it("rejects an invalid type", () => {
		assert.throws(() =>
			BedrockProviderConfigSchema.parse({
				type: "bedrockx",
				model: "us.anthropic.claude-sonnet-4-6",
				region: "us-east-1",
			}),
		);
	});

	it("accepts an application inference profile ARN", () => {
		const result = BedrockProviderConfigSchema.parse({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			applicationInferenceProfile:
				"arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc",
		});
		assert.strictEqual(
			result.applicationInferenceProfile,
			"arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc",
		);
	});

	it("does not require a credentials block", () => {
		const result = BedrockProviderConfigSchema.parse({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
		});
		assert.strictEqual(result.credentials, undefined);
	});
});

describe("resolveBedrockRegion", () => {
	beforeEach(() => clearBedrockEnv());
	afterEach(() => clearBedrockEnv());

	it("prefers BEDROCK_AWS_REGION", () => {
		process.env.BEDROCK_AWS_REGION = "us-west-2";
		process.env.AWS_REGION = "eu-west-1";
		assert.strictEqual(resolveBedrockRegion(), "us-west-2");
	});

	it("falls back to AWS_REGION", () => {
		process.env.AWS_REGION = "eu-west-1";
		assert.strictEqual(resolveBedrockRegion(), "eu-west-1");
	});

	it("returns an empty string when neither is set", () => {
		assert.strictEqual(resolveBedrockRegion(), "");
	});
});

describe("createBedrockChatModel", () => {
	beforeEach(() => clearBedrockEnv());
	afterEach(() => clearBedrockEnv());

	it("returns a ChatBedrockConverse instance for bedrock", () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.constructor.name, "ChatBedrockConverse");
		assert.strictEqual(model.region, "us-east-1");
		assert.strictEqual(model.model, "us.anthropic.claude-sonnet-4-6");
	});

	it("uses the bearer token when AWS_BEARER_TOKEN_BEDROCK is set", () => {
		setBedrockEnv();
		process.env.AWS_BEARER_TOKEN_BEDROCK = "test-bearer-token";
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.bedrockBearerToken, "test-bearer-token");
	});

	it("uses static credentials when no bearer token is set", () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.bedrockApiKey, "test-access-key");
		assert.strictEqual(model.bedrockApiSecret, "test-secret-key");
	});

	it("passes the session token through", () => {
		setBedrockEnv({ BEDROCK_AWS_SESSION_TOKEN: "test-session-token" });
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.bedrockApiSessionToken, "test-session-token");
	});

	it("uses the default credential chain when nothing is set", () => {
		clearBedrockEnv();
		process.env.BEDROCK_AWS_REGION = "us-east-1";
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.bedrockApiKey, undefined);
		assert.strictEqual(model.bedrockApiSecret, undefined);
		assert.strictEqual(typeof model.client.config.credentials, "function");
	});

	it("throws a clear error when the region is missing", () => {
		clearBedrockEnv();
		assert.throws(
			() =>
				createBedrockChatModel({
					type: "bedrock",
					model: "us.anthropic.claude-sonnet-4-6",
					temperature: 0.4,
					maxTokens: -1,
					rateLimit: { maxRetries: 6 },
				}),
			/BEDROCK_AWS_REGION|AWS_REGION/,
		);
	});

	it("maps rateLimit.maxRetries to the SDK maxAttempts", async () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		const maxAttempts = model.client.config.maxAttempts;
		assert.strictEqual(typeof maxAttempts === "function" ? await maxAttempts() : maxAttempts, 6);
	});

	it("omits maxTokens when it is -1", () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.maxTokens, undefined);
	});

	it("passes maxTokens through when it is a positive value", () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: 4096,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.maxTokens, 4096);
	});

	it("passes the application inference profile through", () => {
		setBedrockEnv();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			applicationInferenceProfile:
				"arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(
			model.applicationInferenceProfile,
			"arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc",
		);
	});
});
