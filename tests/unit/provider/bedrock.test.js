import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createBedrockModel, resolveRegion, resolveAuth } from "../../../src/provider/bedrock.js";

/**
 * Save and restore env vars that the Bedrock factory reads.
 * @returns {Function} Restore function
 */
function snapshotEnv() {
	const keys = [
		"AWS_BEARER_TOKEN_BEDROCK",
		"BEDROCK_AWS_ACCESS_KEY_ID",
		"BEDROCK_AWS_SECRET_ACCESS_KEY",
		"BEDROCK_AWS_SESSION_TOKEN",
		"BEDROCK_AWS_REGION",
		"AWS_REGION",
	];
	const saved = {};
	for (const key of keys) saved[key] = process.env[key];
	return () => {
		for (const key of keys) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
}

describe("resolveRegion", () => {
	let restore;
	beforeEach(() => {
		restore = snapshotEnv();
		delete process.env.BEDROCK_AWS_REGION;
		delete process.env.AWS_REGION;
	});
	afterEach(() => restore());

	it("throws a clear error when no region is configured", () => {
		assert.throws(() => resolveRegion(), /region is required/i);
	});

	it("resolves from BEDROCK_AWS_REGION", () => {
		process.env.BEDROCK_AWS_REGION = "us-east-1";
		assert.strictEqual(resolveRegion(), "us-east-1");
	});

	it("falls back to AWS_REGION", () => {
		process.env.AWS_REGION = "eu-west-1";
		assert.strictEqual(resolveRegion(), "eu-west-1");
	});

	it("prefers BEDROCK_AWS_REGION over AWS_REGION", () => {
		process.env.BEDROCK_AWS_REGION = "us-east-1";
		process.env.AWS_REGION = "eu-west-1";
		assert.strictEqual(resolveRegion(), "us-east-1");
	});
});

describe("resolveAuth", () => {
	let restore;
	beforeEach(() => {
		restore = snapshotEnv();
		delete process.env.AWS_BEARER_TOKEN_BEDROCK;
		delete process.env.BEDROCK_AWS_ACCESS_KEY_ID;
		delete process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
		delete process.env.BEDROCK_AWS_SESSION_TOKEN;
	});
	afterEach(() => restore());

	it("uses the bearer token first", () => {
		process.env.AWS_BEARER_TOKEN_BEDROCK = "bearer-token";
		assert.deepStrictEqual(resolveAuth(), { bedrockBearerToken: "bearer-token" });
	});

	it("uses the key pair when no bearer token is set", () => {
		process.env.BEDROCK_AWS_ACCESS_KEY_ID = "AKIA";
		process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = "secret";
		assert.deepStrictEqual(resolveAuth(), {
			bedrockApiKey: "AKIA",
			bedrockApiSecret: "secret",
		});
	});

	it("includes the session token when present", () => {
		process.env.BEDROCK_AWS_ACCESS_KEY_ID = "AKIA";
		process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = "secret";
		process.env.BEDROCK_AWS_SESSION_TOKEN = "session";
		assert.deepStrictEqual(resolveAuth(), {
			bedrockApiKey: "AKIA",
			bedrockApiSecret: "secret",
			bedrockApiSessionToken: "session",
		});
	});

	it("falls back to the default credential chain (empty auth)", () => {
		assert.deepStrictEqual(resolveAuth(), {});
	});
});

describe("createBedrockModel", () => {
	let restore;
	beforeEach(() => {
		restore = snapshotEnv();
		process.env.BEDROCK_AWS_REGION = "us-east-1";
	});
	afterEach(() => restore());

	it("returns a ChatBedrockConverse instance", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.constructor.name, "ChatBedrockConverse");
	});

	it("sets the model and region", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
		});
		assert.strictEqual(model.model, "us.anthropic.claude-sonnet-4-6");
		assert.strictEqual(model.region, "us-east-1");
	});

	it("omits maxTokens when it is -1 (unlimited)", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "m",
			region: "us-east-1",
			maxTokens: -1,
		});
		assert.strictEqual(model.maxTokens, undefined);
	});

	it("passes maxTokens when it is not -1", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "m",
			region: "us-east-1",
			maxTokens: 4096,
		});
		assert.strictEqual(model.maxTokens, 4096);
	});

	it("sets the application inference profile when provided", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "m",
			region: "us-east-1",
			applicationInferenceProfile:
				"arn:aws:bedrock:us-east-1:123:application-inference-profile/fm16bt65tzgx",
		});
		assert.strictEqual(
			model.applicationInferenceProfile,
			"arn:aws:bedrock:us-east-1:123:application-inference-profile/fm16bt65tzgx",
		);
	});

	it("maps rateLimit.maxRetries to caller.maxRetries and clientOptions.maxAttempts", () => {
		const model = createBedrockModel({
			type: "bedrock",
			model: "m",
			region: "us-east-1",
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.caller.maxRetries, 6);
		assert.strictEqual(model.clientOptions.maxAttempts, 6);
	});

	it("throws a clear error when the region is missing", () => {
		delete process.env.BEDROCK_AWS_REGION;
		delete process.env.AWS_REGION;
		assert.throws(
			() =>
				createBedrockModel({
					type: "bedrock",
					model: "m",
				}),
			/region is required/i,
		);
	});
});
