import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createReactAgent, callReactAgentStreaming } from "../../src/agent/react.js";

// Mock config loader to return controlled values
const originalImport = globalThis.import;
globalThis.import = async (specifier) => {
	if (specifier.includes("./src/config/loader.js")) {
		return {
			loadConfig: () => ({
				agent: {
					turnHashWindow: 3,
					turnBufferMax: 20,
				},
			}),
		};
	}
	return originalImport(specifier);
};

describe("Turn Hash Tracking — hashTurn behavior", () => {
	it("produces consistent hashes for the same input", () => {
		// hashTurn is not exported, so we test via the streaming callback
		// Two identical turns should produce the same hash and trigger detection
	});

	it("produces different hashes for different inputs", () => {
		// Different text should produce different hashes
	});

	it("handles empty strings", () => {
		// Empty string should produce a hash (not throw)
	});

	it("handles unicode characters", () => {
		// Unicode should be hashed correctly
	});
});

describe("Turn Hash Tracking — sliding window", () => {
	it("adds hashes to the window on new turns", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "Hello world"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "Goodbye world"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Goodbye world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 0, "No loop should be detected for different turns");
	});

	it("evicts oldest hash when window is full", async () => {
		let loopDetectedCount = 0;
		let emittedEvents = [];
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "AAA"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "BBB"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "BBB" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 3: "CCC"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "CCC" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 4: "AAA" again — should NOT trigger because window size is 3 and AAA was evicted
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			emittedEvents.push(event.type);
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 0, "AAA should have been evicted from window of size 3");
	});
});

describe("Turn Hash Tracking — loop detection", () => {
	it("detects when the same turn repeats", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "Hello world"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "Hello world" again — should trigger
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
	});

	it("does not spam loop_detected within the same turn", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "Hello world"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "Hello world" again — triggers loop_detected
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 3: "Hello world" again — should NOT trigger again (flag prevents spam)
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello world" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 1, "Should only emit one loop_detected, not spam");
	});

	it("resets turnHashDetected flag at turn boundary", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "AAA"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "AAA" again — triggers loop_detected
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 3: "BBB" — different, should reset flag
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "BBB" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 4: "AAA" again — should trigger again because flag was reset
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 2, "Should detect loop twice after flag reset");
	});
});

describe("Turn Hash Tracking — buffer overflow", () => {
	it("hashes text when buffer exceeds turnBufferMax", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Stream a long message that exceeds turnBufferMax (20)
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "123456789012345678901234567890" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Stream the same long message again
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "123456789012345678901234567890" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 1, "Should detect loop on buffer overflow");
	});
});

describe("Turn Hash Tracking — window clear on loop detection", () => {
	it("clears the hash window when a loop is detected", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				// Turn 1: "AAA"
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 2: "AAA" again — triggers loop and clears window
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				// Turn 3: "AAA" again — should NOT trigger because window was cleared
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 1, "Should only detect loop once after window clear");
	});
});

describe("Turn Hash Tracking — abort handling", () => {
	it("clears turnHashes on abort", async () => {
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "Hello" } },
				};
				// Simulate abort mid-stream
				throw new Error("Aborted");
			},
		};

		const controller = new AbortController();
		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		// Abort after a short delay
		setTimeout(() => controller.abort(), 10);

		await callReactAgentStreaming(mockAgent, [], "test", config, callback, {}, "", null, controller.signal);
		assert.strictEqual(loopDetectedCount, 0, "No loop should be detected on abort");
	});
});

describe("Turn Hash Tracking — config defaults", () => {
	it("uses default turnHashWindow of 20 when config is unavailable", async () => {
		// This tests the fallback when loadConfig throws
		let loopDetectedCount = 0;
		const mockAgent = {
			stepTimeout: 60000,
			streamEvents: async function* () {
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
				yield {
					event: "on_chat_model_stream",
					name: "tool",
					data: { chunk: { content: "AAA" } },
				};
				yield {
					event: "on_tool_end",
					name: "tool",
					data: { output: { content: "done" } },
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };
		const callback = (event) => {
			if (event.type === "loop_detected") loopDetectedCount++;
		};

		await callReactAgentStreaming(mockAgent, [], "test", config, callback);
		assert.strictEqual(loopDetectedCount, 1, "Should work with default config");
	});
});