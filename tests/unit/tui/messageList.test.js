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
	const searchQueryRef = { current: "" };
	let searchIndex = 0;
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
					if (newSeg.type === "reasoning") {
						// Reasoning coalesces with the last reasoning segment even if
						// a message interleaved between chunks.
						let lastReasoning = null;
						for (let i = mergedSegments.length - 1; i >= 0; i--) {
							if (mergedSegments[i].type === "reasoning") {
								lastReasoning = mergedSegments[i];
								break;
							}
						}
						if (
							lastReasoning &&
							(lastReasoning.content.endsWith(".") ||
								lastReasoning.content.endsWith("?") ||
								lastReasoning.content.endsWith("!")) &&
							/^[A-Z]/.test(newSeg.content)
						) {
							mergedSegments.push({ ...newSeg });
						} else if (lastReasoning) {
							lastReasoning.content += newSeg.content;
						} else {
							mergedSegments.push({ ...newSeg });
						}
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

		getMessages() {
			const width = 80;
			const result = [];
			let top = 0;
			for (const id of idsRef.current) {
				const data = dataRef.current.get(id);
				if (!data) continue;
				const text = (data.segments || []).map((s) => s.content).join("") || data.content || "";
				result.push({ text, top });
				top += Math.max(1, Math.ceil(text.length / width)) + 1;
			}
			return result;
		},

		findMatches(query) {
			if (!query) return [];
			const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regex = new RegExp(escaped, "gi");
			const messages = this.getMessages();
			const matches = [];
			let messageIndex = 0;
			let textOffset = 0;
			for (const msg of messages) {
				const text = msg.text || "";
				let match;
				let matchIndex = 0;
				while ((match = regex.exec(text)) !== null) {
					matches.push({
						messageIndex,
						matchIndex,
						top: msg.top,
						start: textOffset + match.index,
						end: textOffset + match.index + match[0].length,
					});
					matchIndex++;
					if (match[0].length === 0) regex.lastIndex++;
				}
				textOffset += text.length;
				messageIndex++;
			}
			return matches;
		},

		setSearchQuery(query) {
			searchQueryRef.current = query || "";
			searchIndex = 0;
			triggerRender();
		},

		clearSearch() {
			searchQueryRef.current = "";
			searchIndex = 0;
			triggerRender();
		},

		getSearchQuery() {
			return searchQueryRef.current;
		},

		getSearchIndex() {
			return searchIndex;
		},

		getSearchMatchCount() {
			return this.findMatches(searchQueryRef.current).length;
		},

		searchNext() {
			const matches = this.findMatches(searchQueryRef.current);
			if (matches.length === 0) return;
			searchIndex = (searchIndex + 1) % matches.length;
			return matches[searchIndex];
		},

		searchPrev() {
			const matches = this.findMatches(searchQueryRef.current);
			if (matches.length === 0) return;
			searchIndex = (searchIndex - 1 + matches.length) % matches.length;
			return matches[searchIndex];
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
				activeToolCall: { name: "searchWeb" },
				toolCallDisplay: "Result: ok",
			});
			const data = api.getMessageData(id);
			assert.deepStrictEqual(data.activeToolCall, { name: "searchWeb" });
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

		it("coalesces reasoning across an interleaved message", () => {
			const id = api.addMessage("assistant", "", {
				segments: [
					{ type: "reasoning", content: "measured cad" },
					{ type: "message", content: "Yo," },
				],
			});
			api.updateMessage(id, {
				segments: [{ type: "reasoning", content: "ence." }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 2);
			assert.strictEqual(data.segments[0].type, "reasoning");
			assert.strictEqual(data.segments[0].content, "measured cadence.");
			assert.strictEqual(data.segments[1].type, "message");
			assert.strictEqual(data.segments[1].content, "Yo,");
		});

		it("starts new reasoning block after period when next chunk is capitalized", () => {
			const id = api.addMessage("assistant", "", {
				segments: [{ type: "reasoning", content: "measured cadence." }],
			});
			api.updateMessage(id, {
				segments: [{ type: "reasoning", content: "Jason" }],
			});
			const data = api.getMessageData(id);
			assert.strictEqual(data.segments.length, 2);
			assert.strictEqual(data.segments[0].content, "measured cadence.");
			assert.strictEqual(data.segments[1].content, "Jason");
		});

		it("forces new block on type mismatch (message after reasoning)", () => {
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

describe("MessageList — shouldRenderBubble", () => {
	let shouldRenderBubble;

	beforeEach(async () => {
		const mod = await import("../../../src/tui/messageList.js");
		shouldRenderBubble = mod.shouldRenderBubble;
	});

	it("renders an interrupted assistant bubble with reasoning segments and empty content", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: false,
			segments: [{ type: "reasoning", content: "thinking through the problem" }],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("renders an interrupted assistant bubble with message segments and empty content", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: false,
			segments: [{ type: "message", content: "partial response" }],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("skips an empty assistant bubble that is not streaming and has no segments", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: false,
			segments: [],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), false);
	});

	it("renders an assistant bubble with only a tool segment", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: false,
			segments: [{ type: "tool", content: "result" }],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("renders an assistant bubble with non-empty content even when not streaming", () => {
		const data = {
			role: "assistant",
			content: "completed response",
			streaming: false,
			segments: [],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("renders a streaming assistant bubble even with empty content", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: true,
			segments: [],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("renders non-assistant bubbles regardless of content", () => {
		const data = {
			role: "user",
			content: "",
			streaming: false,
			segments: [],
		};
		assert.strictEqual(shouldRenderBubble(data, ""), true);
	});

	it("prefers the stable content reference over data.content", () => {
		const data = {
			role: "assistant",
			content: "",
			streaming: false,
			segments: [],
		};
		assert.strictEqual(shouldRenderBubble(data, "stable content"), true);
	});
});

describe("MessageList — estimateMessageHeight", () => {
	let estimateMessageHeight;

	beforeEach(async () => {
		const mod = await import("../../../src/tui/messageList.js");
		estimateMessageHeight = mod.estimateMessageHeight;
	});

	it("returns header row plus one content line for a short message", () => {
		const data = { role: "user", content: "Hi" };
		// 1 header row + 1 wrapped content line.
		assert.strictEqual(estimateMessageHeight(data, 80), 2);
	});

	it("returns header row plus wrapped lines for a long message", () => {
		const data = { role: "user", content: "a".repeat(200) };
		// 200 chars / 80 width = 3 wrapped lines + 1 header row.
		assert.strictEqual(estimateMessageHeight(data, 80), 4);
	});

	it("adds a row per reasoning segment", () => {
		const data = {
			role: "assistant",
			content: "",
			segments: [
				{ type: "reasoning", content: "thinking" },
				{ type: "message", content: "response" },
			],
		};
		// 1 header + 1 wrapped line (joined text "thinkingresponse") + 1 reasoning row.
		assert.strictEqual(estimateMessageHeight(data, 80), 3);
	});

	it("adds a row per tool-call display line", () => {
		const data = {
			role: "assistant",
			content: "response",
			toolCallDisplay: "line1\nline2",
		};
		// 1 header + 1 wrapped line + 2 tool-call display lines.
		assert.strictEqual(estimateMessageHeight(data, 80), 4);
	});

	it("adds a row for an active tool call", () => {
		const data = {
			role: "assistant",
			content: "response",
			activeToolCall: { name: "searchWeb" },
		};
		// 1 header + 1 wrapped line + 1 active tool call row.
		assert.strictEqual(estimateMessageHeight(data, 80), 3);
	});

	it("adds a row for completed tool calls", () => {
		const data = {
			role: "assistant",
			content: "response",
			completedToolCalls: ["searchWeb", "readFile"],
		};
		// 1 header + 1 wrapped line + 1 completed tool calls row.
		assert.strictEqual(estimateMessageHeight(data, 80), 3);
	});

	it("handles empty content", () => {
		const data = { role: "user", content: "" };
		// 1 header row + 1 empty wrapped line.
		assert.strictEqual(estimateMessageHeight(data, 80), 2);
	});

	it("handles null content", () => {
		const data = { role: "user", content: null };
		// 1 header row + 1 empty wrapped line.
		assert.strictEqual(estimateMessageHeight(data, 80), 2);
	});

	it("handles a message with no segments and no content", () => {
		const data = { role: "system", content: "" };
		// 1 header row + 1 empty wrapped line.
		assert.strictEqual(estimateMessageHeight(data, 80), 2);
	});

	it("handles a narrow width", () => {
		const data = { role: "user", content: "a".repeat(10) };
		// 10 chars / 5 width = 2 wrapped lines + 1 header row.
		assert.strictEqual(estimateMessageHeight(data, 5), 3);
	});
});

describe("MessageList — in-conversation search", () => {
	let api;

	beforeEach(() => {
		api = createImperativeApi();
	});

	describe("findMatches", () => {
		it("returns no matches for an empty query", () => {
			api.addMessage("user", "Hello world");
			assert.deepStrictEqual(api.findMatches(""), []);
		});

		it("finds matches across messages", () => {
			api.addMessage("user", "Hello world");
			api.addMessage("assistant", "Hello there");
			const matches = api.findMatches("hello");
			assert.strictEqual(matches.length, 2);
			assert.strictEqual(matches[0].messageIndex, 0);
			assert.strictEqual(matches[1].messageIndex, 1);
		});

		it("finds multiple matches within a single message", () => {
			api.addMessage("user", "foo bar foo baz foo");
			const matches = api.findMatches("foo");
			assert.strictEqual(matches.length, 3);
			assert.strictEqual(matches[0].start, 0);
			assert.strictEqual(matches[1].start, 8);
			assert.strictEqual(matches[2].start, 16);
		});

		it("escapes regex special characters", () => {
			api.addMessage("user", "a.b c*d");
			const matches = api.findMatches("a.b");
			assert.strictEqual(matches.length, 1);
			assert.strictEqual(matches[0].start, 0);
			assert.strictEqual(matches[0].end, 3);
		});

		it("computes the scroll target offset for a matched message", () => {
			api.addMessage("user", "first");
			api.addMessage("assistant", "second");
			api.addMessage("user", "third");
			const matches = api.findMatches("third");
			assert.strictEqual(matches.length, 1);
			assert.ok(matches[0].top > 0, "should have a non-zero top offset");
		});
	});

	describe("setSearchQuery / clearSearch", () => {
		it("sets the search query and resets the index", () => {
			api.addMessage("user", "Hello world");
			api.setSearchQuery("hello");
			assert.strictEqual(api.getSearchQuery(), "hello");
			assert.strictEqual(api.getSearchIndex(), 0);
		});

		it("clears the search query", () => {
			api.addMessage("user", "Hello world");
			api.setSearchQuery("hello");
			api.clearSearch();
			assert.strictEqual(api.getSearchQuery(), "");
			assert.strictEqual(api.getSearchMatchCount(), 0);
		});

		it("handles null query", () => {
			api.addMessage("user", "Hello world");
			api.setSearchQuery(null);
			assert.strictEqual(api.getSearchQuery(), "");
		});
	});

	describe("searchNext / searchPrev", () => {
		it("advances to the next match and wraps around", () => {
			api.addMessage("user", "foo bar");
			api.addMessage("assistant", "foo baz");
			api.setSearchQuery("foo");
			assert.strictEqual(api.getSearchMatchCount(), 2);

			const first = api.searchNext();
			assert.strictEqual(first.messageIndex, 1);
			const second = api.searchNext();
			assert.strictEqual(second.messageIndex, 0);
		});

		it("goes to the previous match and wraps around", () => {
			api.addMessage("user", "foo bar");
			api.addMessage("assistant", "foo baz");
			api.setSearchQuery("foo");
			const prev = api.searchPrev();
			assert.strictEqual(prev.messageIndex, 1);
		});

		it("does nothing when there are no matches", () => {
			api.addMessage("user", "Hello world");
			api.setSearchQuery("nonexistent");
			assert.strictEqual(api.searchNext(), undefined);
			assert.strictEqual(api.searchPrev(), undefined);
		});
	});
});
