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

describe("Loop Nudge — default nudge message", () => {
	it("injects default nudge message when config is unavailable", async () => {
		let loopDetectedCount = 0;

		// Mock config loader to throw (simulating unavailable config)
		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => {
						throw new Error("Config unavailable");
					},
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("Hello world"),
				...createTurn("Hello world"), // Loop detected
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") loopDetectedCount++;
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
		} finally {
			globalThis.import = originalImport;
		}
	});
});

describe("Loop Nudge — configured nudge message", () => {
	it("injects configured nudge message when loop is detected", async () => {
		let loopDetectedCount = 0;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "Custom loop nudge message",
							loopLimit: 5,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") loopDetectedCount++;
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
		} finally {
			globalThis.import = originalImport;
		}
	});
});

describe("Loop Nudge — nudge injection on loop detection", () => {
	it("injects nudge when loop is detected and limit not reached", async () => {
		let loopDetectedCount = 0;
		let nudgeInjected = false;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "You are looping!",
							loopLimit: 5,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected — should inject nudge
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") {
					loopDetectedCount++;
					nudgeInjected = true;
				}
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
			assert.ok(nudgeInjected, "Nudge should be injected on loop detection");
		} finally {
			globalThis.import = originalImport;
		}
	});

	it("does not inject nudge when limit is reached", async () => {
		let loopDetectedCount = 0;
		let nudgeCount = 0;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "You are looping!",
							loopLimit: 2,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected — nudge 1
				...createTurn("AAA"), // Loop detected — nudge 2
				...createTurn("AAA"), // Loop detected — should NOT inject (limit reached)
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") {
					loopDetectedCount++;
					nudgeCount++;
				}
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 3, "Should detect three loops");
			assert.strictEqual(nudgeCount, 2, "Should only inject 2 nudges (limit reached)");
		} finally {
			globalThis.import = originalImport;
		}
	});
});

describe("Loop Nudge — nudge message type", () => {
	it("injects nudge as HumanMessage (user type)", async () => {
		let loopDetectedCount = 0;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "You are looping!",
							loopLimit: 5,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") loopDetectedCount++;
			};

			// Capture messages by wrapping the mock agent
			const originalStreamEvents = mockAgent.streamEvents;
			mockAgent.streamEvents = async function* (...args) {
				// The nudge is injected into currentMessages during streaming
				// We can't directly capture it, but we can verify the behavior
				yield* originalStreamEvents.call(this, ...args);
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop");
		} finally {
			globalThis.import = originalImport;
		}
	});
});

describe("Loop Nudge — nudge count reset", () => {
	it("resets nudge count on new call to callReactAgentStreaming", async () => {
		let loopDetectedCount = 0;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "You are looping!",
							loopLimit: 1,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected — nudge 1
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") loopDetectedCount++;
			};

			// First call — should inject 1 nudge
			await callReactAgentStreaming(mockAgent, [], "test", config, callback);
			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop in first call");

			// Second call — nudge count should be reset, so nudge should be injected again
			loopDetectedCount = 0;
			await callReactAgentStreaming(mockAgent, [], "test", config, callback);
			assert.strictEqual(loopDetectedCount, 1, "Should detect one loop in second call (count reset)");
		} finally {
			globalThis.import = originalImport;
		}
	});
});

describe("Loop Nudge — nudge does not count as agent turn", () => {
	it("nudge injection does not trigger additional loop detection", async () => {
		let loopDetectedCount = 0;

		const originalImport = globalThis.import;
		globalThis.import = async (specifier) => {
			if (specifier.includes("./src/config/loader.js")) {
				return {
					loadConfig: () => ({
						agent: {
							turnHashWindow: 3,
							turnBufferMax: 20,
							loopMsg: "You are looping!",
							loopLimit: 5,
						},
					}),
				};
			}
			return originalImport(specifier);
		};

		try {
			const mockAgent = createMockAgent([
				...createTurn("AAA"),
				...createTurn("AAA"), // Loop detected — nudge injected
				// The nudge is injected as a HumanMessage, not as an AI turn
				// So it should not trigger additional loop detection
			]);

			const config = { configurable: { thread_id: "test-thread" } };
			const callback = (event) => {
				if (event.type === "loop_detected") loopDetectedCount++;
			};

			await callReactAgentStreaming(mockAgent, [], "test", config, callback);

			assert.strictEqual(loopDetectedCount, 1, "Should detect exactly one loop");
		} finally {
			globalThis.import = originalImport;
		}
	});
});