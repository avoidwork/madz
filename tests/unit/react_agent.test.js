import { describe, it } from "node:test";
import assert from "node:assert";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [
						{ type: "human", content: input.messages[0].content },
						{ type: "ai", content: "response" },
					],
				};
			},
		};

		await callReactAgent(agentMock, "what is 2+2");
		assert.deepStrictEqual(capturedMessages, [{ role: "user", content: "what is 2+2" }]);
	});

	it("returns { content } with last message content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					{ type: "human", content: "what is 2+2" },
					{ type: "ai", content: "4" },
				],
			}),
		};

		const result = await callReactAgent(agentMock, "what is 2+2");
		assert.deepStrictEqual(result, { content: "4" });
	});

	it("handles multi-turn agent responses", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					{ type: "human", content: "query" },
					{ type: "ai", content: "first thought" },
					{ type: "ai", content: "final answer" },
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query");
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

	it("scans for last AI message with content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					{ type: "human", content: "query" },
					{ type: "ai", content: undefined, tool_calls: [{ name: "search" }] },
					{ type: "tool", content: "search results" },
					{ type: "ai", content: "final answer" },
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query");
		assert.strictEqual(result.content, "final answer");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [{ type: "human", content: "user input" }],
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
