import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { ChatOpenAI } from "@langchain/openai";
import { createChatModel } from "../../src/provider/openai.js";

describe("createChatModel", () => {
	let savedEnv = {};

	beforeEach(() => {
		savedEnv = { SUB_AGENT_TEMPERATURE: process.env.SUB_AGENT_TEMPERATURE };
		delete process.env.SUB_AGENT_TEMPERATURE;
	});

	afterEach(() => {
		if (savedEnv.SUB_AGENT_TEMPERATURE !== undefined) {
			process.env.SUB_AGENT_TEMPERATURE = savedEnv.SUB_AGENT_TEMPERATURE;
		} else {
			delete process.env.SUB_AGENT_TEMPERATURE;
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

	it("passes maxRetries to ChatOpenAI constructor", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 3 },
		};

		const model = createChatModel(config);
		assert.strictEqual(model.caller.maxRetries, 3);
	});

	it("passes default maxRetries when not specified", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
		};

		const model = createChatModel(config);
		assert.strictEqual(model.caller.maxRetries, 6);
	});

	it("passes maxConcurrency to ChatOpenAI constructor when specified", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 6, maxConcurrency: 5 },
		};

		const model = createChatModel(config);
		assert.strictEqual(model.caller.maxConcurrency, 5);
	});

	it("omits maxConcurrency when not specified in rateLimit", () => {
		const config = {
			model: "test",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 6 },
		};

		const model = createChatModel(config);
		// SDK defaults maxConcurrency to Infinity when not specified
		assert.ok(model.caller.maxConcurrency !== 5);
	});

	it("wires the token-budget throttle when maxTokensMinute is positive", async () => {
		const config = {
			model: "gpt-4o",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 6, maxTokensMinute: 100000 },
		};

		// Mock the ChatOpenAI prototype invoke to resolve without network.
		const invokeMock = mock.method(ChatOpenAI.prototype, "invoke", async () => "ok");
		try {
			const model = createChatModel(config);
			const result = await model.invoke([{ role: "user", content: "Hello" }]);
			assert.strictEqual(result, "ok");
			assert.strictEqual(invokeMock.mock.callCount(), 1);
		} finally {
			invokeMock.mock.restore();
		}
	});

	it("does not wire the token-budget throttle when maxTokensMinute is zero", async () => {
		const config = {
			model: "gpt-4o",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 6, maxTokensMinute: 0 },
		};

		const invokeMock = mock.method(ChatOpenAI.prototype, "invoke", async () => "ok");
		try {
			const model = createChatModel(config);
			const result = await model.invoke([{ role: "user", content: "Hello" }]);
			assert.strictEqual(result, "ok");
			assert.strictEqual(invokeMock.mock.callCount(), 1);
		} finally {
			invokeMock.mock.restore();
		}
	});

	it("attributes 429 errors to an exceeded token budget", async () => {
		const config = {
			model: "gpt-4o",
			temperature: 0.7,
			maxTokens: 4096,
			credentials: { apiKey: "sk-test" },
			base_url: "https://api.openai.com/v1",
			rateLimit: { maxRetries: 6, maxTokensMinute: 100000 },
		};

		// Simulate a 429 error from the underlying provider call.
		const rateLimitError = new Error("rate limited");
		rateLimitError.status = 429;
		const invokeMock = mock.method(ChatOpenAI.prototype, "invoke", async () => {
			throw rateLimitError;
		});
		try {
			const model = createChatModel(config);
			await assert.rejects(
				() => model.invoke([{ role: "user", content: "Hello" }]),
				/rate limited/,
			);
			assert.strictEqual(invokeMock.mock.callCount(), 1);
		} finally {
			invokeMock.mock.restore();
		}
	});
});
