import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [
						new HumanMessage(input.messages[0].content),
						new SystemMessage("system"),
						new AIMessage("response"),
					],
				};
			},
		};

		await callReactAgent(agentMock, "what is 2+2", null);
		assert.ok(capturedMessages.length >= 1);
		assert.ok(capturedMessages[0] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[0].content, "what is 2+2");
	});

	it("prepends system message on new thread (default)", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "hello world", null, "You are a helpful assistant.");
		assert.strictEqual(capturedMessages.length, 2);
		assert.ok(capturedMessages[0] instanceof SystemMessage);
		assert.strictEqual(capturedMessages[0].content, "You are a helpful assistant.");
		assert.ok(capturedMessages[1] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[1].content, "hello world");
	});

	it("skips system message when isNewThread is false (thread has history)", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(
			agentMock,
			"hello world",
			{ configurable: { thread_id: "abc", isNewThread: false } },
			"You are a helpful assistant.",
		);
		assert.strictEqual(capturedMessages.length, 1);
		assert.ok(capturedMessages[0] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[0].content, "hello world");
	});

	it("invokes agent with config object", async () => {
		let capturedConfig = null;

		const agentMock = {
			invoke: (input) => {
				capturedConfig = input;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		const config = { configurable: { thread_id: "abc-123" } };
		await callReactAgent(agentMock, "hello", config);
		assert.strictEqual(capturedConfig.configurable.thread_id, "abc-123");
	});

	it("returns { content } with last message content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new SystemMessage("system prompt"),
					new HumanMessage("what is 2+2"),
					new AIMessage("4"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "what is 2+2", null, "system prompt");
		assert.deepStrictEqual(result, { content: "4" });
	});

	it("handles multi-turn agent responses", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new SystemMessage("system"),
					new HumanMessage("query"),
					new AIMessage("first thought"),
					new AIMessage("final answer"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query", null, "system");
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
			await callReactAgent(agentMock, "test", null);
		} catch (err) {
			caughtError = err;
		}

		assert.ok(caughtError instanceof Error);
		assert.strictEqual(caughtError.message, "model unavailable");
	});

	it("scans for last AIMessage ignoring tool calls", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new HumanMessage("query"),
					new AIMessage("", {
						content: "",
						tool_calls: [{ name: "search", args: {} }],
					}),
					new AIMessage("final answer"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "query", null);
		assert.strictEqual(result.content, "final answer");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("user input")],
			}),
		};

		const result = await callReactAgent(agentMock, "user input", null);
		assert.strictEqual(result.content, "user input");
	});

	it("falls back to input message when all messages lack content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [],
			}),
		};

		const result = await callReactAgent(agentMock, "fallback text", null);
		assert.strictEqual(result.content, "fallback text");
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

describe("callReactAgent streaming", () => {
	it("calls callback with text event for each token delta", async () => {
		const messages = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "Hello" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: ",  " },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "world!" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "search", toolCallId: "1" } },
			},
		];
		let msgIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (msgIdx < messages.length) {
								return Promise.resolve({ value: messages[msgIdx++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hello", null, null, callback);
		assert.strictEqual(callbackCalls.length, 4); // 3 text + 1 tool_start
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "Hello");
		assert.strictEqual(callbackCalls[1].type, "text");
		assert.strictEqual(callbackCalls[1].text, "Hello,");
		assert.strictEqual(callbackCalls[2].type, "text");
		assert.strictEqual(callbackCalls[2].text, "Hello,  world!");
		assert.strictEqual(callbackCalls[3].type, "tool_start");
		assert.strictEqual(result.content, "Hello,  world!");
	});

	it("callback receives text events only when content is non-empty", async () => {
		const messages = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "   hello" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
		];
		let msgIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (msgIdx < messages.length) {
								msgIdx++;
								return Promise.resolve({ value: messages[msgIdx - 1], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "fallback", null, null, callback);
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "hello");
		assert.strictEqual(result.content, "   hello");
	});

	it("callback receives tool events from protocol stream", async () => {
		const toolEvents = [
			{ method: "updates", params: { data: { node: "agent" } } },
			{
				method: "tools",
				params: {
					data: { event: "tool_called", name: "read_file", toolCallId: "abc-123", input: {} },
				},
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool_finished",
						name: "read_file",
						toolCallId: "abc-123",
						output: "file contents",
					},
				},
			},
			{
				method: "tools",
				params: {
					data: {
						event: "partial_error",
						name: "write_file",
						toolCallId: "xyz-456",
						message: "permission denied",
					},
				},
			},
		];
		let toolIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (toolIdx < toolEvents.length) {
								return Promise.resolve({ value: toolEvents[toolIdx++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		await callReactAgent(agentMock, "test", null, null, callback);
		assert.strictEqual(callbackCalls.length, 3);
		assert.strictEqual(callbackCalls[0].type, "tool_start");
		assert.strictEqual(callbackCalls[0].toolName, "read_file");
		assert.strictEqual(callbackCalls[1].type, "tool_end");
		assert.strictEqual(callbackCalls[1].toolName, "read_file");
		assert.strictEqual(callbackCalls[1].data, "file contents");
		assert.strictEqual(callbackCalls[2].type, "tool_error");
		assert.strictEqual(callbackCalls[2].toolName, "write_file");
		assert.strictEqual(callbackCalls[2].error, "permission denied");
	});

	it("falls back to original message when no text content", async () => {
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

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "original message", null, null, callback);
		assert.strictEqual(callbackCalls.length, 0);
		assert.strictEqual(result.content, "original message");
	});

	it("callback not called when no streaming callback provided", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new AIMessage("full response")],
			}),
		};

		const result = await callReactAgent(agentMock, "ask", null, "system");
		assert.strictEqual(result.content, "full response");
	});

	it("handles text from event chunks (replaces ChatModelStream iteration)", async () => {
		const messages = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "sync text" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
		];
		let idx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (idx < messages.length) {
								idx++;
								return Promise.resolve({ value: messages[idx - 1], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hi", null, null, callback);
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "sync text");
		assert.strictEqual(result.content, "sync text");
	});

	it("handles tool_event emission from partial_result events", async () => {
		const toolEvents = [
			{
				method: "tools",
				params: { data: { event: "partial_result", toolCallId: "1", output: "step 1 done" } },
			},
		];
		let toolIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (toolIdx < toolEvents.length) {
								return Promise.resolve({ value: toolEvents[toolIdx++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		await callReactAgent(agentMock, "test", null, null, callback);
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "tool_event");
		assert.strictEqual(callbackCalls[0].data, "step 1 done");
	});

	it("skips text on ChatModelStream when text throws", async () => {
		let count = 0;
		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return {
							next() {
								if (count < 1) {
									count++;
									return Promise.resolve({
										value: {
											get text() {
												throw new Error("no text available");
											},
										},
										done: false,
									});
								}
								return Promise.resolve({ done: true });
							},
						};
					},
				},
				[Symbol.asyncIterator]() {
					return { next: () => Promise.resolve({ done: true }) };
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "fallback", null, null, callback);
		assert.strictEqual(callbackCalls.length, 0);
		assert.strictEqual(result.content, "fallback");
	});

	it("survives callback throwing during tool events", async () => {
		const toolEvents = [
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "search", toolCallId: "1" } },
			},
		];
		let toolIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (toolIdx < toolEvents.length) {
								toolIdx++;
								return Promise.resolve({
									value: toolEvents[toolIdx - 1],
									done: false,
								});
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callback = () => {
			throw new Error("callback crashed");
		};

		const result = await callReactAgent(agentMock, "original", null, null, callback);
		assert.strictEqual(result.content, "original");
	});

	it("does not hang when ChatModelStream has no text but tool events follow", async () => {
		const startTime = Date.now();
		const TIMEOUT_MS = 3000;

		const toolEvents = [
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "web_search", toolCallId: "tool-1" } },
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool_finished",
						name: "web_search",
						toolCallId: "tool-1",
						output: '{"ok":false,"error":"none"}',
					},
				},
			},
		];
		let toolIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				// This ChatModelStream has no text — iterating .text would hang
				// because ReplayBuffer.waiters is never notified.
				messages: {
					[Symbol.asyncIterator]() {
						return {
							next() {
								return new Promise((resolve) => {
									setTimeout(() => {
										resolve({
											value: {
												text: {
													[Symbol.asyncIterator]() {
														return {
															next() {
																return new Promise(() => {
																	// never resolve — simulates ReplayBuffer blocking
																});
															},
														};
													},
												},
											},
											done: false,
										});
									}, 50);
								});
							},
						};
					},
				},
				// Raw stream yields tool events
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (toolIdx < toolEvents.length) {
								toolIdx++;
								return Promise.resolve({ value: toolEvents[toolIdx - 1], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(
			agentMock,
			"use web_search to find info",
			null,
			null,
			callback,
		);

		const elapsed = Date.now() - startTime;
		assert.ok(elapsed < TIMEOUT_MS, `Streaming hung for ${elapsed}ms (limit ${TIMEOUT_MS}ms)`);
		assert.strictEqual(callbackCalls.length, 2);
		assert.strictEqual(callbackCalls[0].type, "tool_start");
		assert.strictEqual(callbackCalls[1].type, "tool_end");
		assert.strictEqual(result.content, "use web_search to find info");
	});

	it("captures text after tool events in single-stream pass", async () => {
		// Events are interleaved: tool events come first, then text chunks
		const allMessages = [
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "read_file", toolCallId: "1" } },
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool_finished",
						name: "read_file",
						toolCallId: "1",
						output: "file content",
					},
				},
			},
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "Found results" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
		];
		let msgIdx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (msgIdx < allMessages.length) {
								msgIdx++;
								return Promise.resolve({ value: allMessages[msgIdx - 1], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "query", null, null, callback);
		assert.strictEqual(callbackCalls.length, 3); // 2 tool + 1 text
		assert.strictEqual(callbackCalls[0].type, "tool_start");
		assert.strictEqual(callbackCalls[1].type, "tool_end");
		assert.strictEqual(callbackCalls[2].type, "text");
		assert.strictEqual(result.content, "Found results");
	});

	it("returns content from ChatModelStream text event chunks", async () => {
		const messages = [
			{
				method: "messages",
				params: {
					data: { event: "message-start", id: "1", role: "ai" },
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "messages",
				params: {
					data: { event: "content-block-start", index: 0, content: [{ type: "text" }] },
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "Hello" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: " World" },
					},
					chunk: { type: "ChatModelStream", index: 0 },
				},
			},
		];
		let idx = 0;

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						return { next: () => Promise.resolve({ done: true }) };
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							if (idx < messages.length) {
								idx++;
								return Promise.resolve({ value: messages[idx - 1], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hi", null, null, callback);
		assert.strictEqual(result.content, "Hello World");
		assert.strictEqual(callbackCalls[0].type, "text");
	});
});
