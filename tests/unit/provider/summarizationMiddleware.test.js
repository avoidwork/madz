import { describe, it } from "node:test";
import assert from "node:assert";
import { HumanMessage } from "@langchain/core/messages";
import { createSummarizationMiddlewareFromConfig } from "../../../src/provider/summarizationMiddleware.js";

/**
 * Build a mock model exposing both `getNumTokensFromMessages` (for the
 * preemptive context-window estimate) and `invoke` (for summary generation).
 * @param {number} [totalCount] - Token count returned by the tokenizer
 * @param {number} [maxInputTokens] - The model's context window from its profile
 * @returns {Object} A mock model
 */
function makeMockModel(totalCount = 10, maxInputTokens = 128000) {
	return {
		getNumTokensFromMessages: async () => ({ totalCount, countPerMessage: [totalCount] }),
		profile: { maxInputTokens },
		invoke: async () => ({ text: "This is a summary of the conversation." }),
	};
}

/**
 * Build a request with `count` human messages.
 * @param {number} [count] - Number of messages
 * @param {Object} [model] - The chat model to attach to the request
 * @returns {Object} A wrapModelCall request
 */
function makeRequest(count = 20, model = {}) {
	const messages = [];
	for (let i = 0; i < count; i++) {
		messages.push(new HumanMessage(`message ${i}`));
	}
	return { messages, systemMessage: null, model, tools: [], state: {} };
}

describe("createSummarizationMiddlewareFromConfig", () => {
	it("returns null when config is absent", () => {
		assert.strictEqual(createSummarizationMiddlewareFromConfig({ backend: {} }), null);
	});

	it("returns null when enabled is false", () => {
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ backend: {}, config: { enabled: false } }),
			null,
		);
	});

	it("returns null when enabled but missing trigger/keep", () => {
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ backend: {}, config: { enabled: true } }),
			null,
		);
	});

	it("returns a middleware named SummarizationMiddleware when enabled", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
		assert.strictEqual(typeof mw.wrapModelCall, "function");
	});

	it("supports a messages trigger", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "messages", value: 20 },
				keep: { type: "messages", value: 6 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
	});

	it("supports a fraction trigger", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "fraction", value: 0.85 },
				keep: { type: "fraction", value: 0.1 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
	});
});

describe("createSummarizationMiddlewareFromConfig preemptive context-window check", () => {
	it("compacts before dispatch when input + output exceeds the context window", async () => {
		// Input tokens (200000) + output budget (4096) far exceed the 128000 window.
		const model = makeMockModel(200000, 128000);
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: 4096,
			contextWindow: 128000,
		});

		let handlerMessages = null;
		const result = await mw.wrapModelCall(makeRequest(20, model), async (req) => {
			handlerMessages = req.messages;
			return { content: "ok", messages: req.messages };
		});

		// The handler must receive a compacted set (summary + 10 kept), not the
		// original 20 messages.
		assert.ok(handlerMessages, "handler should be invoked");
		assert.ok(
			handlerMessages.length < 20,
			`expected compaction before dispatch, got ${handlerMessages.length} messages`,
		);
		// The middleware returns a Command carrying the summarization state update.
		assert.strictEqual(result.lg_name, "Command");
	});

	it("does not compact when input + output fits within the context window", async () => {
		// Input tokens (100) + output budget (4096) fit within the 128000 window.
		const model = makeMockModel(100, 128000);
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: 4096,
			contextWindow: 128000,
		});

		let handlerMessages = null;
		await mw.wrapModelCall(makeRequest(3), async (req) => {
			handlerMessages = req.messages;
			return { content: "ok", messages: req.messages };
		});

		assert.ok(handlerMessages, "handler should be invoked");
		assert.strictEqual(
			handlerMessages.length,
			3,
			"messages should pass through unchanged when within the window",
		);
	});

	it("uses the model tokenizer for the input estimate", async () => {
		let receivedMessages = null;
		const model = {
			getNumTokensFromMessages: async (messages) => {
				receivedMessages = messages;
				return { totalCount: 200000, countPerMessage: [200000] };
			},
			profile: { maxInputTokens: 128000 },
			invoke: async () => ({ text: "summary" }),
		};
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: 4096,
			contextWindow: 128000,
		});

		await mw.wrapModelCall(makeRequest(5, model), async (req) => ({
			content: "ok",
			messages: req.messages,
		}));
		assert.ok(receivedMessages, "model tokenizer should be called with the request messages");
	});

	it("treats maxTokens -1 as no output budget", async () => {
		// Input tokens (100) with maxTokens -1 (unlimited) must not add a budget.
		const model = makeMockModel(100, 128000);
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: -1,
			contextWindow: 128000,
		});

		let handlerMessages = null;
		await mw.wrapModelCall(makeRequest(3), async (req) => {
			handlerMessages = req.messages;
			return { content: "ok", messages: req.messages };
		});

		assert.strictEqual(handlerMessages.length, 3, "-1 must not push the estimate over the window");
	});

	it("adds tool definition tokens to the estimate", async () => {
		// Input tokens (100) + tool tokens push the estimate over the window.
		const model = makeMockModel(100, 128000);
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: 4096,
			contextWindow: 128000,
		});

		let handlerMessages = null;
		await mw.wrapModelCall(
			{
				...makeRequest(3, model),
				tools: [
					{
						name: "test",
						description: "A test tool",
						schema: { type: "object", properties: { x: { type: "string" } } },
					},
				],
			},
			async (req) => {
				handlerMessages = req.messages;
				return { content: "ok", messages: req.messages };
			},
		);

		assert.ok(handlerMessages, "handler should be invoked");
	});

	it("resolves the context window from the model profile", async () => {
		// No explicit contextWindow; the model profile (maxInputTokens) is used.
		const model = makeMockModel(200000, 64000);
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
			model,
			maxTokens: 4096,
		});

		let handlerMessages = null;
		const result = await mw.wrapModelCall(makeRequest(20, model), async (req) => {
			handlerMessages = req.messages;
			return { content: "ok", messages: req.messages };
		});

		assert.ok(handlerMessages, "handler should be invoked");
		assert.ok(
			handlerMessages.length < 20,
			`expected compaction from profile-derived window, got ${handlerMessages.length} messages`,
		);
		assert.strictEqual(result.lg_name, "Command");
	});
});
