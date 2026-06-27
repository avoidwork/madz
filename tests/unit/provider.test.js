import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createChatModel } from "../../src/provider/openai.js";

describe("createChatModel", () => {
	let savedEnv = {};

	beforeEach(() => {
		savedEnv = { SUBAGENT_TEMPERATURE: process.env.SUBAGENT_TEMPERATURE };
		delete process.env.SUBAGENT_TEMPERATURE;
	});

	afterEach(() => {
		if (savedEnv.SUBAGENT_TEMPERATURE !== undefined) {
			process.env.SUBAGENT_TEMPERATURE = savedEnv.SUBAGENT_TEMPERATURE;
		} else {
			delete process.env.SUBAGENT_TEMPERATURE;
		}
	});
	it("returns a ChatOpenAI instance", () => {
		const config = {
			model: "gpt-4o",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.ok(model !== null && model !== undefined);
	});

	it("passes model to ChatOpenAI constructor", () => {
		const config = {
			model: "llama3.1",
			temperature: 0.5,
			maxTokens: 2048,
			credentials: { apiKey: "local-key" },
			base_url: "http://localhost:11434/v1",
		};

		const model = createChatModel(config);
		// Verify the model property is accessible on the returned instance
		assert.ok(model.model === "llama3.1");
	});

	it("passes temperature to ChatOpenAI constructor", () => {
		const config = {
			model: "gpt-4",
			temperature: 1.2,
			maxTokens: 1024,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.temperature, 1.2);
	});

	it("passes base_url as configuration.baseURL", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "x" },
			base_url: "http://localhost:11434/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.clientConfig?.baseURL, "http://localhost:11434/v1");
	});

	it("passes credentials.apiKey as openAIApiKey", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "my-secret-key" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.apiKey, "my-secret-key");
	});

	it("enables streaming by default", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.streaming, true);
	});

	it("allows disabling streaming via config", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			streaming: false,
		};

		const model = createChatModel(config);
		assert.strictEqual(model.streaming, false);
	});

	it("overrides temperature via SUBAGENT_TEMPERATURE env var", () => {
		process.env.SUBAGENT_TEMPERATURE = "0.3";
		const config = {
			model: "gpt-4",
			temperature: 0.7,
			maxTokens: 1024,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.temperature, 0.3);
	});

	it("ignores invalid SUBAGENT_TEMPERATURE env var", () => {
		process.env.SUBAGENT_TEMPERATURE = "invalid";
		const config = {
			model: "gpt-4",
			temperature: 0.7,
			maxTokens: 1024,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.temperature, 0.7);
	});

	it("ignores out-of-range SUBAGENT_TEMPERATURE env var", () => {
		process.env.SUBAGENT_TEMPERATURE = "5";
		const config = {
			model: "gpt-4",
			temperature: 0.7,
			maxTokens: 1024,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.temperature, 0.7);
	});

	it("ignores empty SUBAGENT_TEMPERATURE env var", () => {
		process.env.SUBAGENT_TEMPERATURE = "";
		const config = {
			model: "gpt-4",
			temperature: 0.7,
			maxTokens: 1024,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.temperature, 0.7);
	});
});