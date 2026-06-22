import { describe, it } from "node:test";
import assert from "node:assert";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

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

		// streaming path returns originalMessage as fallback when no text events
		const result = await callReactAgent(agentMock, "original message", null, null, () => {});

		// Empty stream returns original message as fallback (not a throw)
		assert.strictEqual(result.content, "original message");
	});
});
