import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [
						new HumanMessage(input.messages[0].content),
						new SystemMessage("system"),
						new AIMessage("response"),
					],
				};
			},
		};

		await callReactAgent(agentMock, "what is 2+2");
		assert.ok(capturedMessages.length >= 1);
		assert.ok(capturedMessages[0] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[0].content, "what is 2+2");
	});

	it("invokes agent with system message when provided", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "hello world", "You are a helpful assistant.");
		assert.strictEqual(capturedMessages.length, 2);
		assert.ok(capturedMessages[0] instanceof SystemMessage);
		assert.strictEqual(capturedMessages[0].content, "You are a helpful assistant.");
		assert.ok(capturedMessages[1] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[1].content, "hello world");
	});

	it("returns { content } with last message content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new SystemMessage("system prompt"),
					new HumanMessage("what is 2+2"),
					new AIMessage("4"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "what is 2+2", "system prompt");
		assert.deepStrictEqual(result, { content: "4" });
	});

	it("handles multi-turn agent responses", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new SystemMessage("system"),
					new HumanMessage("query"),
					new AIMessage("first thought"),
					new AIMessage("final answer"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query", "system");
		assert.strictEqual(result.content, "final answer");
	});

	it("re-throws errors from agent.invoke", async () => {
		const agentMock = {
			invoke: () => {
				throw new Error("model unavailable");
			},
		};

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "test");
		} catch (err) {
			caughtError = err;
		}

		assert.ok(caughtError instanceof Error);
		assert.strictEqual(caughtError.message, "model unavailable");
	});

	it("scans for last AIMessage ignoring tool calls", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new HumanMessage("query"),
					new AIMessage("", {
						content: "",
						tool_calls: [{ name: "search", args: {} }],
					}),
					new AIMessage("final answer"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query");
		assert.strictEqual(result.content, "final answer");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("user input")],
			}),
		};

		const result = await callReactAgent(agentMock, "user input");
		assert.strictEqual(result.content, "user input");
	});

	it("falls back to input message when all messages lack content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [],
			}),
		};

		const result = await callReactAgent(agentMock, "fallback text");
		assert.strictEqual(result.content, "fallback text");
	});

	it("uses config for checkpointing when provided", async () => {
		let capturedConfig = null;
		const agentMock = {
			invoke: (input, config) => {
				capturedConfig = config;
				return { messages: [new AIMessage("response")] };
			},
		};

		const threadConfig = { configurable: { thread_id: "test-thread" } };
		await callReactAgent(agentMock, "hello", null, threadConfig);
		assert.strictEqual(capturedConfig.configurable.thread_id, "test-thread");
	});

	it("works without config when none provided", async () => {
		let capturedConfig = null;
		const agentMock = {
			invoke: (input, config) => {
				capturedConfig = config;
				return { messages: [new AIMessage("response")] };
			},
		};

		await callReactAgent(agentMock, "hello", null, null);
		assert.strictEqual(capturedConfig, null);
	});
});

describe("createReactAgent", () => {
	it("passes model and empty tools to langgraph createReactAgent", async () => {
		const fakeModel = { lc_kwargs: { model: "test" } };
		const agent = createReactAgent(fakeModel);
		assert.ok(agent);
	});

	it("passes tools array to langgraph createReactAgent", async () => {
		const fakeModel = { lc_kwargs: { model: "test" } };
		const tools = [{ name: "search" }];
		const agent = createReactAgent(fakeModel, tools);
		assert.ok(agent);
	});
});
