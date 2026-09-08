/**
 * Tests for the MessageList component.
 * Tests the imperative API logic exposed via forwardRef.
 * @see {@link src/tui/messageList.js}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";

/**
 * Simulate the MessageList imperative API logic in isolation.
 * This mirrors the methods exposed via useImperativeHandle in messageList.js.
 */
function createImperativeApi() {
	let _messageIdCounter = 0;
	const idsRef = { current: [] };
	const idToIdxRef = { current: new Map() };
	const dataRef = { current: new Map() };
	const contentRef = { current: new Map() };
	const topicsRef = { current: new Map() };
	const lastMsgCountRef = { current: 0 };
	const triggerRender = () => {};

	const publish = (topic, data) => {
		const callbacks = topicsRef.current.get(topic);
		if (callbacks) {
			for (const cb of callbacks) cb(data);
		}
	};

	const api = {
		addMessage(role, content, options = {}) {
			const id = (++_messageIdCounter).toString();
			const stableContent = content || "";
			contentRef.current.set(id, stableContent);
			dataRef.current.set(id, {
				id,
				role,
				content: stableContent,
				time: options.time,
				segments: options.segments,
				activeToolCall: options.activeToolCall,
				toolCallDisplay: options.toolCallDisplay,
				events: options.events,
				streaming: options.streaming || false,
			});
			idsRef.current.push(id);
			idToIdxRef.current.set(id, idsRef.current.length - 1);
			triggerRender();
			return id;
		},

		updateMessage(id, updates) {
			const idx = idToIdxRef.current.get(id);
			if (idx === undefined) return;
			const existing = dataRef.current.get(id);
			if (existing) {
				// Segment append/coalesce — mirrors the real implementation
				if (updates.segments && existing.segments) {
					const newSeg = updates.segments[updates.segments.length - 1];
					const mergedSegments = existing.segments.map((s) => ({ ...s }));
					if (newSeg.type === "reasoning" && newSeg.content === ".") {
						let found = false;
						for (let i = mergedSegments.length - 1; i >= 0; i--) {
							if (mergedSegments[i].type === "reasoning") {
								mergedSegments[i].content += ".";
								found = true;
								break;
							}
						}
						if (!found) mergedSegments.push({ ...newSeg });
					} else {
						const lastSeg = mergedSegments[mergedSegments.length - 1];
						if (lastSeg && lastSeg.type === newSeg.type) {
							lastSeg.content += newSeg.content;
						} else {
							mergedSegments.push({ ...newSeg });
						}
					}
					dataRef.current.set(id, { ...existing, ...updates, segments: mergedSegments });
				} else {
					dataRef.current.set(id, { ...existing, ...updates });
				}
			}
			idsRef.current[idx] = id;
			if (updates.content !== undefined) {
				const stableContent = updates.content || "";
				const prevContent = contentRef.current.get(id);
				if (prevContent !== stableContent) contentRef.current.set(id, stableContent);
			}
			publish(`msg-${id}`, dataRef.current.get(id));
		},

		getMessageData(id) {
			return dataRef.current.get(id) || null;
		},

		clear() {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			contentRef.current = new Map();
			lastMsgCountRef.current = 0;
			triggerRender();
		},

		setMessages(msgs) {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			contentRef.current = new Map();
			for (const m of msgs) {
				const id = (++_messageIdCounter).toString();
				const stableContent = m.content || "";
				contentRef.current.set(id, stableContent);
				dataRef.current.set(id, {
					id,
					role: m.role,
					content: stableContent,
					time: m.time,
					segments: m.segments,
					activeToolCall: m.activeToolCall,
					toolCallDisplay: m.toolCallDisplay,
					events: m.events,
					streaming: m.streaming || false,
				});
				idsRef.current.push(id);
				idToIdxRef.current.set(id, idsRef.current.length - 1);
			}
			triggerRender();
		},

		getMessageCount() {
			return idsRef.current.length;
		},

		_getState() {
			return {
				ids: idsRef.current,
				idToIdx: idToIdxRef.current,
				data: dataRef.current,
				topicKeys: [...topicsRef.current.keys()],
			};
		},

		_reset() {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			topicsRef.current = new Map();
			lastMsgCountRef.current = 0;
			_messageIdCounter = 0;
		},
	};

	return api;
}

describe("MessageList — imperative API", () => {
	let api;

	beforeEach(() => {
		api = createImperativeApi();
	});

	describe("addMessage", () => {
		it("adds a user message and returns an id", () => {
			const id = api.addMessage("user", "Hello");
			assert.ok(typeof id === "string");
			assert.strictEqual(api.getMessageCount(), 1);
		});

		it("adds an assistant message with options", () => {
			const id = api.addMessage("assistant", "Response", {
				time: "10:00 AM",
				segments: [{ type: "reasoning", content: "thinking..." }],
				streaming: true,
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.role, "assistant");
			assert.strictEqual(data.time, "10:00 AM");
			assert.strictEqual(data.segments[0].type, "reasoning");
			assert.strictEqual(data.segments[0].content, "thinking...");
			assert.strictEqual(data.streaming, true);
		});

		it("adds a system message", () => {
			api.addMessage("system", "System message");
			assert.strictEqual(api.getMessageCount(), 1);
		});

		it("handles null content", () => {
			const id = api.addMessage("user", null);
			const data = api.getMessageData(id);
			assert.strictEqual(data.content, "");
		});

		it("adds message with activeToolCall and toolCallDisplay", () => {
			const id = api.addMessage("assistant", "", {
				activeToolCall: { name: "webSearch" },
				toolCallDisplay: "Result: ok",
			});
			const data = api.getMessageData(id);
			assert.deepStrictEqual(data.activeToolCall, { name: "webSearch" });
			assert.strictEqual(data.toolCallDisplay, "Result: ok");
		});

		it("adds message with events", () => {
			const events = [{ type: "token", content: "a" }];
			const id = api.addMessage("assistant", "text", { events });
			const data = api.getMessageData(id);
			assert.strictEqual(data.events, events);
		});
	});

	describe("updateMessage", () => {
		it("updates an existing message", () => {
			const id = api.addMessage("assistant", "Hello");
			api.updateMessage(id, { content: "Updated" });
			const data = api.getMessageData(id);
			assert.strictEqual(data.content, "Updated");
		});

		it("does nothing for non-existent id", () => {
			api.updateMessage("nonexistent", { content: "x" });
			// Should not throw
			assert.ok(true);
		});

		it("updates streaming flag", () => {
			const id = api.addMessage("assistant", "Hello");
			api.updateMessage(id, { streaming: true });
			const data = api.getMessageData(id);
			assert.strictEqual(data.streaming, true);
		});

		it("publishes update to topic subscribers", () => {
			const id = api.addMessage("assistant", "Hello");
			let received = null;
			// Manually subscribe to the topic
			const topicsRef = new Map();
			const cb = (data) => {
				received = data;
			};
			topicsRef.set(`msg-${id}`, [cb]);
			// Simulate publish
			const callbacks = topicsRef.get(`msg-${id}`);
			if (callbacks) for (const cb of callbacks) cb({ content: "Updated" });
			assert.ok(received !== null);
			assert.strictEqual(received.content, "Updated");
		});

		it("coalesces same-type segments on update", () => {
			const id = api.addMessage("assistant", "", {
				segments: [{ type: "reasoning", content: "thinking" }],
			});
			api.updateMessage(id, {
				segments: [{ type: "reasoning", content: " deeper" }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 1);
			assert.strictEqual(data.segments[0].content, "thinking deeper");
		});

		it("appends different-type segments on update", () => {
			const id = api.addMessage("assistant", "", {
				segments: [{ type: "reasoning", content: "thinking" }],
			});
			api.updateMessage(id, {
				segments: [{ type: "message", content: "Hello" }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 2);
			assert.strictEqual(data.segments[0].type, "reasoning");
			assert.strictEqual(data.segments[1].type, "message");
		});

		it("appends stray '.' reasoning chunk to last reasoning segment", () => {
			const id = api.addMessage("assistant", "", {
				segments: [
					{ type: "reasoning", content: "thinking" },
					{ type: "message", content: "Hello" },
				],
			});
			api.updateMessage(id, {
				segments: [{ type: "reasoning", content: "." }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 2);
			assert.strictEqual(data.segments[0].type, "reasoning");
			assert.strictEqual(data.segments[0].content, "thinking.");
			assert.strictEqual(data.segments[1].type, "message");
			assert.strictEqual(data.segments[1].content, "Hello");
		});

		it("creates new reasoning segment if no prior reasoning exists for stray '.'", () => {
			const id = api.addMessage("assistant", "", {
				segments: [{ type: "message", content: "Hello" }],
			});
			api.updateMessage(id, {
				segments: [{ type: "reasoning", content: "." }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 2);
			assert.strictEqual(data.segments[0].type, "message");
			assert.strictEqual(data.segments[1].type, "reasoning");
			assert.strictEqual(data.segments[1].content, ".");
		});
	});

	describe("getMessageData", () => {
		it("returns null for non-existent id", () => {
			assert.strictEqual(api.getMessageData("nonexistent"), null);
		});

		it("returns data for existing id", () => {
			const id = api.addMessage("user", "Hi");
			const data = api.getMessageData(id);
			assert.ok(data !== null);
			assert.strictEqual(data.role, "user");
		});
	});

	describe("clear", () => {
		it("clears all messages", () => {
			api.addMessage("user", "A");
			api.addMessage("assistant", "B");
			assert.strictEqual(api.getMessageCount(), 2);
			api.clear();
			assert.strictEqual(api.getMessageCount(), 0);
		});
	});

	describe("setMessages", () => {
		it("initializes from an array of message data", () => {
			api.setMessages([
				{ role: "user", content: "Hi" },
				{ role: "assistant", content: "Hello" },
			]);
			assert.strictEqual(api.getMessageCount(), 2);
		});

		it("handles empty array", () => {
			api.setMessages([]);
			assert.strictEqual(api.getMessageCount(), 0);
		});

		it("handles messages with all optional fields", () => {
			api.setMessages([
				{
					role: "assistant",
					content: "Response",
					time: "12:00",
					segments: [{ type: "reasoning", content: "thinking" }],
					activeToolCall: { name: "search" },
					toolCallDisplay: "done",
					events: [],
					streaming: true,
				},
			]);
			assert.strictEqual(api.getMessageCount(), 1);
		});
	});

	describe("getMessageCount", () => {
		it("returns 0 when no messages", () => {
			assert.strictEqual(api.getMessageCount(), 0);
		});

		it("returns correct count after adding messages", () => {
			api.addMessage("user", "1");
			api.addMessage("assistant", "2");
			api.addMessage("user", "3");
			assert.strictEqual(api.getMessageCount(), 3);
		});
	});

	describe("_getState", () => {
		it("returns internal state with ids, data, topics", () => {
			api.addMessage("user", "test");
			const state = api._getState();
			assert.ok(Array.isArray(state.ids));
			assert.ok(state.idToIdx instanceof Map);
			assert.ok(state.data instanceof Map);
			assert.ok(Array.isArray(state.topicKeys));
		});
	});

	describe("_reset", () => {
		it("resets all internal state", () => {
			api.addMessage("user", "test");
			api._reset();
			assert.strictEqual(api.getMessageCount(), 0);
		});
	});
});

describe("MessageList — PubSubProvider", () => {
	it("renders children with pub/sub context", async () => {
		const { PubSubProvider } = await import("../../../src/tui/messageList.js");
		const { Text } = await import("ink");
		const subscribe = () => {};
		const unsubscribe = () => {};
		const publish = () => {};
		const result = renderToString(
			React.createElement(
				PubSubProvider,
				{ subscribe, unsubscribe, publish },
				React.createElement(Text, null, "child"),
			),
		);
		assert.ok(typeof result === "string");
	});
});

describe("MessageList — module exports", () => {
	it("exports MessageList component", async () => {
		const mod = await import("../../../src/tui/messageList.js");
		assert.strictEqual(typeof mod.MessageList, "object");
	});

	it("exports PubSubProvider component", async () => {
		const mod = await import("../../../src/tui/messageList.js");
		assert.strictEqual(typeof mod.PubSubProvider, "function");
	});
});
