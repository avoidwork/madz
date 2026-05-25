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
						{ role: "user", content: input.messages[0].content },
						{ role: "assistant", content: "response" },
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
					{ role: "user", content: "what is 2+2" },
					{ role: "assistant", content: "4" },
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
					{ role: "user", content: "query" },
					{ role: "assistant", content: "first thought" },
					{ role: "assistant", content: "final answer" },
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
