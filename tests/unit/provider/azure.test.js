import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createAzureChatModel, resolveAzureEndpoint } from "../../../src/provider/azure.js";
import { AzureProviderConfigSchema } from "../../../src/config/schemas/providers.js";

const AZURE_ENV_KEYS = [
	"AZURE_OPENAI_API_KEY",
	"AZURE_OPENAI_ENDPOINT",
	"AZURE_OPENAI_API_INSTANCE_NAME",
	"AZURE_OPENAI_API_DEPLOYMENT_NAME",
	"AZURE_OPENAI_API_VERSION",
];

function clearAzureEnv() {
	for (const key of AZURE_ENV_KEYS) {
		delete process.env[key];
	}
}

function setAzureEnv(overrides = {}) {
	clearAzureEnv();
	process.env.AZURE_OPENAI_API_KEY = overrides.AZURE_OPENAI_API_KEY ?? "test-key";
	process.env.AZURE_OPENAI_ENDPOINT =
		overrides.AZURE_OPENAI_ENDPOINT ?? "https://myresource.openai.azure.com";
	process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME =
		overrides.AZURE_OPENAI_API_DEPLOYMENT_NAME ?? "gpt-4o";
	if (overrides.AZURE_OPENAI_API_VERSION) {
		process.env.AZURE_OPENAI_API_VERSION = overrides.AZURE_OPENAI_API_VERSION;
	}
}

describe("AzureProviderConfigSchema", () => {
	it("accepts a valid azure-openai config", () => {
		const result = AzureProviderConfigSchema.parse({
			type: "azure-openai",
			model: "gpt-4o",
			enabled: true,
			temperature: 0.4,
			maxTokens: -1,
			contextWindow: 128000,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(result.type, "azure-openai");
		assert.strictEqual(result.model, "gpt-4o");
		assert.strictEqual(result.enabled, true);
	});

	it("defaults type to azure-openai", () => {
		const result = AzureProviderConfigSchema.parse({ model: "gpt-4o" });
		assert.strictEqual(result.type, "azure-openai");
	});

	it("defaults enabled to true", () => {
		const result = AzureProviderConfigSchema.parse({ model: "gpt-4o" });
		assert.strictEqual(result.enabled, true);
	});

	it("rejects a missing model", () => {
		assert.throws(() => AzureProviderConfigSchema.parse({ type: "azure-openai" }));
	});

	it("rejects an invalid type", () => {
		assert.throws(() => AzureProviderConfigSchema.parse({ type: "azure", model: "gpt-4o" }));
	});

	it("rejects a non-https endpoint", () => {
		assert.throws(() =>
			AzureProviderConfigSchema.parse({
				type: "azure-openai",
				model: "gpt-4o",
				endpoint: "http://myresource.openai.azure.com",
			}),
		);
	});

	it("accepts an https endpoint", () => {
		const result = AzureProviderConfigSchema.parse({
			type: "azure-openai",
			model: "gpt-4o",
			endpoint: "https://myresource.openai.azure.com",
		});
		assert.strictEqual(result.endpoint, "https://myresource.openai.azure.com");
	});

	it("does not require a credentials block", () => {
		const result = AzureProviderConfigSchema.parse({ type: "azure-openai", model: "gpt-4o" });
		assert.strictEqual(result.credentials, undefined);
	});
});

describe("resolveAzureEndpoint", () => {
	beforeEach(() => clearAzureEnv());
	afterEach(() => clearAzureEnv());

	it("prefers AZURE_OPENAI_ENDPOINT", () => {
		process.env.AZURE_OPENAI_ENDPOINT = "https://myresource.openai.azure.com";
		process.env.AZURE_OPENAI_API_INSTANCE_NAME = "other-instance";
		assert.strictEqual(resolveAzureEndpoint(), "https://myresource.openai.azure.com");
	});

	it("strips a trailing slash from the endpoint", () => {
		process.env.AZURE_OPENAI_ENDPOINT = "https://myresource.openai.azure.com/";
		assert.strictEqual(resolveAzureEndpoint(), "https://myresource.openai.azure.com");
	});

	it("derives the endpoint from AZURE_OPENAI_API_INSTANCE_NAME", () => {
		process.env.AZURE_OPENAI_API_INSTANCE_NAME = "myresource";
		assert.strictEqual(resolveAzureEndpoint(), "https://myresource.openai.azure.com");
	});

	it("returns an empty string when neither is set", () => {
		assert.strictEqual(resolveAzureEndpoint(), "");
	});
});

describe("createAzureChatModel", () => {
	beforeEach(() => clearAzureEnv());
	afterEach(() => clearAzureEnv());

	it("returns an AzureChatOpenAI instance for azure-openai", () => {
		setAzureEnv();
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.constructor.name, "AzureChatOpenAI");
		assert.strictEqual(model.azureOpenAIApiKey, "test-key");
		assert.strictEqual(model.azureOpenAIEndpoint, "https://myresource.openai.azure.com");
		assert.strictEqual(model.azureOpenAIApiDeploymentName, "gpt-4o");
	});

	it("uses the deployment name as the model", () => {
		setAzureEnv({ AZURE_OPENAI_API_DEPLOYMENT_NAME: "my-deployment" });
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.azureOpenAIApiDeploymentName, "my-deployment");
	});

	it("passes the api version through", () => {
		setAzureEnv({ AZURE_OPENAI_API_VERSION: "2024-10-21" });
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.azureOpenAIApiVersion, "2024-10-21");
	});

	it("throws a clear error when AZURE_OPENAI_API_KEY is missing", () => {
		setAzureEnv();
		delete process.env.AZURE_OPENAI_API_KEY;
		assert.throws(
			() =>
				createAzureChatModel({
					type: "azure-openai",
					model: "gpt-4o",
					temperature: 0.4,
					maxTokens: -1,
					rateLimit: { maxRetries: 6 },
				}),
			/AZURE_OPENAI_API_KEY/,
		);
	});

	it("throws a clear error when the endpoint is missing", () => {
		setAzureEnv();
		delete process.env.AZURE_OPENAI_ENDPOINT;
		delete process.env.AZURE_OPENAI_API_INSTANCE_NAME;
		assert.throws(
			() =>
				createAzureChatModel({
					type: "azure-openai",
					model: "gpt-4o",
					temperature: 0.4,
					maxTokens: -1,
					rateLimit: { maxRetries: 6 },
				}),
			/AZURE_OPENAI_ENDPOINT|AZURE_OPENAI_API_INSTANCE_NAME/,
		);
	});

	it("throws a clear error when the deployment name is missing", () => {
		setAzureEnv();
		delete process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
		assert.throws(
			() =>
				createAzureChatModel({
					type: "azure-openai",
					temperature: 0.4,
					maxTokens: -1,
					rateLimit: { maxRetries: 6 },
				}),
			/AZURE_OPENAI_API_DEPLOYMENT_NAME/,
		);
	});

	it("falls back to config.model as the deployment name", () => {
		setAzureEnv();
		delete process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.azureOpenAIApiDeploymentName, "gpt-4o");
	});

	it("omits maxTokens when it is -1", () => {
		setAzureEnv();
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.maxTokens, undefined);
	});

	it("passes maxTokens through when it is a positive value", () => {
		setAzureEnv();
		const model = createAzureChatModel({
			type: "azure-openai",
			model: "gpt-4o",
			temperature: 0.4,
			maxTokens: 4096,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.maxTokens, 4096);
	});
});
