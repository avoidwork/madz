import { createPubSub } from "../../src/tui/messageBubble.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

/**
 * Simulates the imperative API used by MessageList without React.
 * Tests the new startTime, toolCallCount, and turnDurationMs fields.
 */
describe("messageList - tool call count and turn duration", () => {
	let pubsub;
	let idsRef;
	let idToIdxRef;
	let dataRef;

	function reset() {
		pubsub = createPubSub();
		idsRef = [];
		idToIdxRef = new Map();
		dataRef = new Map();
	}

	beforeEach(reset);

	function addMessage(role, content, options = {}) {
		const id = (++global._msgIdCounter || (global._msgIdCounter = 0)).toString();
		dataRef.set(id, {
			id,
			role,
			content: content || "",
			time: options.time,
			reasoningContent: options.reasoningContent,
			activeToolCall: options.activeToolCall,
			toolCallDisplay: options.toolCallDisplay,
			streaming: options.streaming || false,
			startTime: options.startTime,
			toolCallCount: options.toolCallCount,
			turnDurationMs: options.turnDurationMs,
		});
		idsRef.push(id);
		idToIdxRef.set(id, idsRef.length - 1);
		return id;
	}

	function updateMessage(id, updates) {
		const idx = idToIdxRef.get(id);
		if (idx === undefined) return;
		const existing = dataRef.get(id);
		if (existing) {
			dataRef.set(id, { ...existing, ...updates });
		}
		idsRef[idx] = id;
		pubsub.publish(`msg-${id}`, dataRef.get(id));
	}

	function setMessages(msgs) {
		idsRef = [];
		idToIdxRef = new Map();
		dataRef = new Map();

		for (const m of msgs) {
			const id = (++global._msgIdCounter || (global._msgIdCounter = 0)).toString();
			dataRef.set(id, {
				id,
				role: m.role,
				content: m.content || "",
				time: m.time,
				reasoningContent: m.reasoningContent,
				activeToolCall: m.activeToolCall,
				toolCallDisplay: m.toolCallDisplay,
				events: m.events,
				streaming: m.streaming || false,
				startTime: m.startTime,
				toolCallCount: m.toolCallCount,
				turnDurationMs: m.turnDurationMs,
			});
			idsRef.push(id);
			idToIdxRef.set(id, idsRef.length - 1);
		}
	}

	/**
	 * Simulates the turn stats rendering logic from MessageBubble.
	 * Returns the formatted string if stats should be shown, null otherwise.
	 */
	function simulateTurnStats(role, toolCallCount, turnDurationMs) {
		if (
			role !== "assistant" ||
			!toolCallCount ||
			toolCallCount <= 0 ||
			!turnDurationMs ||
			turnDurationMs <= 0
		) {
			return null;
		}
		return `🔧 ${toolCallCount} tool${toolCallCount > 1 ? "s" : ""} · ⏱ ${Math.round(turnDurationMs / 100) / 10}s`;
	}

	describe("addMessage with new fields", () => {
		it("stores startTime when provided", () => {
			const now = Date.now();
			const id = addMessage("assistant", "hello", { startTime: now });
			assert.strictEqual(dataRef.get(id).startTime, now);
		});

		it("stores toolCallCount when provided", () => {
			const id = addMessage("assistant", "hello", { toolCallCount: 3 });
			assert.strictEqual(dataRef.get(id).toolCallCount, 3);
		});

		it("stores turnDurationMs when provided", () => {
			const id = addMessage("assistant", "hello", { turnDurationMs: 2400 });
			assert.strictEqual(dataRef.get(id).turnDurationMs, 2400);
		});

		it("stores all three fields together", () => {
			const now = Date.now();
			const id = addMessage("assistant", "hello", {
				startTime: now,
				toolCallCount: 2,
				turnDurationMs: 1500,
			});
			const msg = dataRef.get(id);
			assert.strictEqual(msg.startTime, now);
			assert.strictEqual(msg.toolCallCount, 2);
			assert.strictEqual(msg.turnDurationMs, 1500);
		});

		it("does not store fields when not provided", () => {
			const id = addMessage("assistant", "hello");
			const msg = dataRef.get(id);
			assert.strictEqual(msg.startTime, undefined);
			assert.strictEqual(msg.toolCallCount, undefined);
			assert.strictEqual(msg.turnDurationMs, undefined);
		});

		it("user messages can also carry the fields (for completeness)", () => {
			const id = addMessage("user", "hello", { toolCallCount: 0, turnDurationMs: 0 });
			const msg = dataRef.get(id);
			assert.strictEqual(msg.toolCallCount, 0);
			assert.strictEqual(msg.turnDurationMs, 0);
		});
	});

	describe("updateMessage with new fields", () => {
		it("updates toolCallCount on existing message", () => {
			const id = addMessage("assistant", "hello");
			updateMessage(id, { toolCallCount: 5 });
			assert.strictEqual(dataRef.get(id).toolCallCount, 5);
		});

		it("updates turnDurationMs on existing message", () => {
			const id = addMessage("assistant", "hello", { startTime: Date.now() - 3000 });
			updateMessage(id, { turnDurationMs: 3000 });
			assert.strictEqual(dataRef.get(id).turnDurationMs, 3000);
		});

		it("merges new fields with existing data", () => {
			const id = addMessage("assistant", "hello", { toolCallCount: 2 });
			updateMessage(id, { turnDurationMs: 1200 });
			const msg = dataRef.get(id);
			assert.strictEqual(msg.toolCallCount, 2);
			assert.strictEqual(msg.turnDurationMs, 1200);
		});
	});

	describe("setMessages with new fields", () => {
		it("restores startTime from messages array", () => {
			const now = Date.now();
			setMessages([{ role: "assistant", content: "hi", startTime: now }]);
			assert.strictEqual(dataRef.get(idsRef[0]).startTime, now);
		});

		it("restores toolCallCount from messages array", () => {
			setMessages([{ role: "assistant", content: "hi", toolCallCount: 4 }]);
			assert.strictEqual(dataRef.get(idsRef[0]).toolCallCount, 4);
		});

		it("restores turnDurationMs from messages array", () => {
			setMessages([{ role: "assistant", content: "hi", turnDurationMs: 5000 }]);
			assert.strictEqual(dataRef.get(idsRef[0]).turnDurationMs, 5000);
		});

		it("restores all three fields from messages array", () => {
			const now = Date.now();
			setMessages([
				{
					role: "assistant",
					content: "hi",
					startTime: now,
					toolCallCount: 3,
					turnDurationMs: 2500,
				},
			]);
			const msg = dataRef.get(idsRef[0]);
			assert.strictEqual(msg.startTime, now);
			assert.strictEqual(msg.toolCallCount, 3);
			assert.strictEqual(msg.turnDurationMs, 2500);
		});
	});

	describe("MessageBubble turn stats rendering", () => {
		it("renders stats for assistant with tools and duration", () => {
			const result = simulateTurnStats("assistant", 3, 2400);
			assert.strictEqual(result, "🔧 3 tools · ⏱ 2.4s");
		});

		it("renders stats for assistant with single tool", () => {
			const result = simulateTurnStats("assistant", 1, 500);
			assert.strictEqual(result, "🔧 1 tool · ⏱ 0.5s");
		});

		it("renders stats for assistant with zero duration", () => {
			const result = simulateTurnStats("assistant", 2, 0);
			assert.strictEqual(result, null);
		});

		it("renders stats for assistant with zero tool count", () => {
			const result = simulateTurnStats("assistant", 0, 1000);
			assert.strictEqual(result, null);
		});

		it("does not render stats for user messages", () => {
			const result = simulateTurnStats("user", 3, 2400);
			assert.strictEqual(result, null);
		});

		it("does not render stats for system messages", () => {
			const result = simulateTurnStats("system", 3, 2400);
			assert.strictEqual(result, null);
		});

		it("handles undefined toolCallCount", () => {
			const result = simulateTurnStats("assistant", undefined, 1000);
			assert.strictEqual(result, null);
		});

		it("handles undefined turnDurationMs", () => {
			const result = simulateTurnStats("assistant", 2, undefined);
			assert.strictEqual(result, null);
		});

		it("formats duration with one decimal place", () => {
			const result = simulateTurnStats("assistant", 1, 1234);
			assert.strictEqual(result, "🔧 1 tool · ⏱ 1.2s");
		});

		it("formats duration rounded to nearest tenth", () => {
			const result = simulateTurnStats("assistant", 1, 1250);
			assert.strictEqual(result, "🔧 1 tool · ⏱ 1.3s");
		});

		it("handles large tool counts", () => {
			const result = simulateTurnStats("assistant", 15, 10000);
			assert.strictEqual(result, "🔧 15 tools · ⏱ 10s");
		});

		it("handles sub-second duration", () => {
			const result = simulateTurnStats("assistant", 1, 50);
			assert.strictEqual(result, "🔧 1 tool · ⏱ 0.1s");
		});
	});

	describe("integration: full flow simulation", () => {
		it("simulates the full app.js flow: add -> update with stats -> render", () => {
			const startTime = Date.now() - 2400;
			const id = addMessage("assistant", "", {
				startTime,
				streaming: true,
			});

			// Simulate finalizeStreaming updating the message
			updateMessage(id, {
				content: "Here is the result.",
				streaming: false,
				toolCallCount: 3,
				turnDurationMs: 2400,
			});

			const msg = dataRef.get(id);
			assert.strictEqual(msg.content, "Here is the result.");
			assert.strictEqual(msg.toolCallCount, 3);
			assert.strictEqual(msg.turnDurationMs, 2400);

			// Simulate what MessageBubble would render
			const stats = simulateTurnStats(msg.role, msg.toolCallCount, msg.turnDurationMs);
			assert.strictEqual(stats, "🔧 3 tools · ⏱ 2.4s");
		});

		it("no stats rendered when no tools were called", () => {
			const startTime = Date.now() - 500;
			const id = addMessage("assistant", "simple answer", {
				startTime,
			});

			updateMessage(id, {
				toolCallCount: 0,
				turnDurationMs: 500,
			});

			const msg = dataRef.get(id);
			const stats = simulateTurnStats(msg.role, msg.toolCallCount, msg.turnDurationMs);
			assert.strictEqual(stats, null);
		});
	});
});
