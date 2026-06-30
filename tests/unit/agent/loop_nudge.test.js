import { describe, it } from "node:test";
import assert from "node:assert";
import { callReactAgentStreaming } from "../../src/agent/react.js";

// Helper to create a mock agent that yields events
function createMockAgent(events) {
	return {
		stepTimeout: 60000,
		streamEvents: async function* () {
			for (const evt of events) {
				yield evt;
			}
		},
	};
}

// Helper to create events for a turn
function createTurn(text) {
	return [
		{
			event: "on_chat_model_stream",
			name: "tool",
			data: { chunk: { content: text } },
		},
		{
			event: "on_tool_end",
			name: "tool",
			data: { output: { content: "done" } },
		},
	];
}

// Helper to mock config loader
function mockConfig(config) {
	const originalImport = globalThis.import;
	globalThis.import = async (specifier) => {
		if (specifier.includes("./src/config/loader.js")) {
			return { loadConfig: () => config };
		}
		return originalImport(specifier);
	};
	return () => { globalThis.import = originalImport; };
}

describe("Loop Nudge — stream breaks on loop detection", () => {
	it("breaks stream and injects nudge into messages on next iteration", async () => {
		const restore = mockConfig({
			agent: {
				turnHashWindow: 3,
				turnBufferMax: 20,
				loopMsg: "You are looping!",
				loopLimit: 5,
			},
		});

		try {
			let streamCallCount = 0;
			const capturedMessages = [];

			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected — should break stream
			]);

			// Wrap streamEvents to capture messages passed and control iteration
			const originalStreamEvents = mockAgent.streamEvents;
			mockAgent.streamEvents = async function* (...args) {
				streamCallCount++;
				capturedMessages.push(JSON.parse(JSON.stringify(args[0]?.messages || [])));

				// On first call, yield events to trigger loop detection
				// On second call (after nudge injected), yield a normal completion
				if (streamCallCount === 1) {
					yield* originalStreamEvents.call(this, ...args);
				} else {
					// Second iteration: yield a normal completion event
					yield {
						event: "on_chat_model_stream",
						name: "tool",
						data: { chunk: { content: "recovered" } },
					};
					yield {
						event: "on_tool_end",
						name: "tool",
						data: { output: { content: "done" } },
					};
				}
			};

			const config = { configurable: { thread_id: "test-thread" } };

			await callReactAgentStreaming(mockAgent, [], "test", config, () => {}, {
				turnHashWindow: 3,
				turnBufferMax: 20,
			});

			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
			assert.strictEqual(streamCallCount, 2, "Stream should restart after nudge injection");

			// Verify nudge was injected into messages on second call
			const secondCallMessages = capturedMessages[1];
			const nudgeFound = secondCallMessages.some(
				(m) => m.content === "You are looping!"
			);
			assert.ok(nudgeFound, "Nudge should be in messages on second stream call");
		} finally {
			restore();
		}
	});
});

describe("Loop Nudge — respects limit", () => {
	it("stops injecting nudges after limit reached", async () => {
		const restore = mockConfig({
			agent: {
				turnHashWindow: 3,
				turnBufferMax: 20,
				loopMsg: "You are looping!",
				loopLimit: 2,
			},
		});

		try {
			let streamCallCount = 0;
			const nudgeInMessages = [];

			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"),
			]);

			const originalStreamEvents = mockAgent.streamEvents;
			mockAgent.streamEvents = async function* (...args) {
				streamCallCount++;
				const msgs = args[0]?.messages || [];
				nudgeInMessages.push(msgs.filter((m) => m.content === "You are looping!").length);

				if (streamCallCount <= 2) {
					yield* originalStreamEvents.call(this, ...args);
				} else {
					yield {
						event: "on_chat_model_stream",
						name: "tool",
						data: { chunk: { content: "done" } },
					};
					yield {
						event: "on_tool_end",
						name: "tool",
						data: { output: { content: "done" } },
					};
				}
			};

			const config = { configurable: { thread_id: "test-thread" } };

			await callReactAgentStreaming(mockAgent, [], "test", config, () => {}, {
				turnHashWindow: 3,
				turnBufferMax: 20,
			});

			// 2 nudges injected (limit is 2), then no more
			assert.strictEqual(nudgeInMessages.filter((c) => c > 0).length, 2, "Should inject exactly 2 nudges");
		} finally {
			restore();
		}
	});
});

describe("Loop Nudge — uses configured message", () => {
	it("injects custom nudge message when configured", async () => {
		const restore = mockConfig({
			agent: {
				turnHashWindow: 3,
				turnBufferMax: 20,
				loopMsg: "Custom nudge: stop looping",
				loopLimit: 5,
			},
		});

		try {
			let streamCallCount = 0;
			const capturedMessages = [];

			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"),
			]);

			const originalStreamEvents = mockAgent.streamEvents;
			mockAgent.streamEvents = async function* (...args) {
				streamCallCount++;
				capturedMessages.push(args[0]?.messages || []);

				if (streamCallCount === 1) {
					yield* originalStreamEvents.call(this, ...args);
				} else {
					yield {
						event: "on_chat_model_stream",
						name: "tool",
						data: { chunk: { content: "done" } },
					};
					yield {
						event: "on_tool_end",
						name: "tool",
						data: { output: { content: "done" } },
					};
				}
			};

			const config = { configurable: { thread_id: "test-thread" } };
			await callReactAgentStreaming(mockAgent, [], "test", config, () => {}, {
				turnHashWindow: 3,
				turnBufferMax: 20,
			});

			const secondCallMessages = capturedMessages[1];
			const customNudgeFound = secondCallMessages.some(
				(m) => m.content === "Custom nudge: stop looping"
			);
			assert.ok(customNudgeFound, "Should inject custom nudge message");
		} finally {
			restore();
		}
	});
});

describe("Loop Nudge — resets on new call", () => {
	it("nudge count resets between separate calls to callReactAgentStreaming", async () => {
		const restore = mockConfig({
			agent: {
				turnHashWindow: 3,
				turnBufferMax: 20,
				loopMsg: "You are looping!",
				loopLimit: 1,
			},
		});

		try {
			let streamCallCount = 0;

			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"),
			]);

			const originalStreamEvents = mockAgent.streamEvents;
			mockAgent.streamEvents = async function* (...args) {
				streamCallCount++;
				if (streamCallCount <= 2) {
					yield* originalStreamEvents.call(this, ...args);
				} else {
					yield {
						event: "on_chat_model_stream",
						name: "tool",
						data: { chunk: { content: "done" } },
					};
					yield {
						event: "on_tool_end",
						name: "tool",
						data: { output: { content: "done" } },
					};
				}
			};

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = () => {};

			// First call — should inject 1 nudge
			await callReactAgentStreaming(mockAgent, [], "test", config, callback, {
				turnHashWindow: 3,
				turnBufferMax: 20,
			});

			// Second call — nudge count resets (new function invocation), so nudge injected again
			await callReactAgentStreaming(mockAgent, [], "test", config, callback, {
				turnHashWindow: 3,
				turnBufferMax: 20,
			});

			// 2 stream calls per invocation × 2 invocations = 4 total
			assert.strictEqual(streamCallCount, 4, "Should have 4 stream calls (2 per invocation)");
		} finally {
			restore();
		}
	});
});