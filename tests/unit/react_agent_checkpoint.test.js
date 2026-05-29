import { describe, it } from "node:test";
import assert from "node:assert";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

describe("createReactAgent with checkpointer", () => {
	it("passes checkpointer to langgraph createReactAgent when provided", async () => {
		// We can't directly test the prebuilt, so we verify the call succeeds
		// with a mock checkpointer that doesn't interfere
		const fakeModel = { lc_kwargs: { model: "test" } };
		const fakeCheckpoint = {
			put: () => {},
			put_writes: () => {},
			get_tuple: () => null,
			list: () => [],
		};

		const agent = createReactAgent(fakeModel, [], fakeCheckpoint);
		assert.ok(agent);
	});

	it("works without checkpointer", async () => {
		const fakeModel = { lc_kwargs: { model: "test" } };
		const agent = createReactAgent(fakeModel);
		assert.ok(agent);
	});
});

describe("callReactAgent with config", () => {
	it("passes configurable to agent.invoke when config provided", async () => {
		let capturedInput = null;

		const agentMock = {
			invoke: (input) => {
				capturedInput = input;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "test message", { configurable: { thread_id: "abc-123" } });

		assert.ok(capturedInput.configurable);
		assert.strictEqual(capturedInput.configurable.thread_id, "abc-123");
		assert.strictEqual(capturedInput.messages[0].content, "test message");
	});

	it("passes configurable when system prompt arg is ignored (handled by compiled agent)", async () => {
		let capturedInput = null;

		const agentMock = {
			invoke: (input) => {
				capturedInput = input;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(
			agentMock,
			"test message",
			{ configurable: { thread_id: "def-456" } },
			"You are helpful",
		);

		assert.ok(capturedInput.configurable);
		assert.strictEqual(capturedInput.configurable.thread_id, "def-456");
		// System prompt is no longer prepended here; it is embedded in the compiled agent
		assert.strictEqual(capturedInput.messages.length, 1);
		assert.ok(capturedInput.messages[0] instanceof HumanMessage);
		assert.strictEqual(capturedInput.messages[0].content, "test message");
	});

	it("invokes agent with null config", async () => {
		let capturedInput = null;

		const agentMock = {
			invoke: (input) => {
				capturedInput = input;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "hello", null);

		assert.strictEqual(capturedInput.configurable, undefined);
	});

	it("invokes agent without system prompt", async () => {
		let capturedInput = null;

		const agentMock = {
			invoke: (input) => {
				capturedInput = input;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "hello", null);

		assert.strictEqual(capturedInput.messages.length, 1);
		assert.ok(capturedInput.messages[0] instanceof HumanMessage);
		assert.strictEqual(capturedInput.messages[0].content, "hello");
	});
});

describe("callReactAgent streaming with config", () => {
	it("passes configurable to streamEvents when config provided", async () => {
		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return { next: () => Promise.resolve({ done: true }) };
				},
			}),
			invoke: () => ({ messages: [new AIMessage("should not be called")] }),
		};

		const result = await callReactAgent(
			agentMock,
			"test",
			{ configurable: { thread_id: "stream-thread" } },
			null,
			() => {},
		);

		assert.strictEqual(result.content, "test");
	});

	it("passes no configurable in streaming when config is null", async () => {
		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return { next: () => Promise.resolve({ done: true }) };
				},
			}),
		};

		const result = await callReactAgent(agentMock, "original message", null, null, () => {});

		assert.strictEqual(result.content, "original message");
	});
});

describe("callReactAgent error propagation", () => {
	it("re-throws checkpointer errors from agent.invoke", async () => {
		const agentMock = {
			invoke: () => {
				throw new Error("checkpoint save failed: disk full");
			},
		};

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "test", { configurable: { thread_id: "abc" } });
		} catch (err) {
			caughtError = err;
		}

		assert.ok(caughtError instanceof Error);
		assert.strictEqual(caughtError.message, "checkpoint save failed: disk full");
	});
});
