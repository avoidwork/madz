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
		let capturedConfig = null;

		const agentMock = {
			invoke: (input, configuration) => {
				capturedInput = input;
				capturedConfig = configuration;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "test message", { configurable: { thread_id: "abc-123" } });

		assert.ok(capturedInput);
		assert.strictEqual(capturedInput.messages[0].content, "test message");
		assert.ok(capturedConfig);
		assert.ok(capturedConfig.configurable);
		assert.strictEqual(capturedConfig.configurable.thread_id, "abc-123");
	});

	it("skips system message when isNewThread is false (thread has history)", async () => {
		let capturedInput = null;
		let capturedConfig = null;

		const agentMock = {
			invoke: (input, configuration) => {
				capturedInput = input;
				capturedConfig = configuration;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(
			agentMock,
			"test message",
			{ configurable: { thread_id: "def-456", isNewThread: false } },
			"You are helpful",
		);

		assert.ok(capturedInput);
		assert.ok(capturedConfig);
		assert.strictEqual(capturedConfig.configurable.thread_id, "def-456");
		assert.strictEqual(capturedConfig.configurable.isNewThread, false);
		// System prompt is skipped when thread has history (checkpointer carries it)
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
		let capturedStreamOptions = null;
		const agentMock = {
			streamEvents: (_input, options) => {
				capturedStreamOptions = options;
				return (async function* () {})();
			},
		};

		await callReactAgent(
			agentMock,
			"test",
			{ configurable: { thread_id: "stream-thread" } },
			null,
			() => {},
		);

		assert.ok(capturedStreamOptions);
		assert.strictEqual(capturedStreamOptions.configurable.thread_id, "stream-thread");
		// Empty stream returns fallback content (not a throw)
	});

	it("passes configurable to streamEvents when config is null", async () => {
		const agentMock = {
			streamEvents: (_input, _options) => {
				return (async function* () {})();
			},
		};

		// streaming path returns recursion limit message when no text events
		const result = await callReactAgent(agentMock, "original message", null, null, () => {});

		// Empty stream returns recursion limit message (not original message)
		assert.strictEqual(
			result.content,
			"I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new conversation if you'd prefer.",
		);
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
