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
				return { messages: [new AIMessage("response")] };
			},
		};
		await callReactAgent(agentMock, "hello world", null, "You are a helpful assistant.");
		assert.strictEqual(capturedMessages.length, 2);
		assert.ok(capturedMessages[0] instanceof SystemMessage);
		assert.strictEqual(capturedMessages[0].content, "You are a helpful assistant.");
		assert.ok(capturedMessages[1] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[1].content, "hello world");
	});

	it("skips system message when isNewThread is false", async () => {
		let capturedMessages = null;
		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return { messages: [new AIMessage("response")] };
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
				return { messages: [new AIMessage("response")] };
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
					new AIMessage("", { tool_calls: [{ name: "search", args: {} }] }),
					new AIMessage("final answer"),
				],
			}),
		};
		const result = await callReactAgent(agentMock, "query", null);
		assert.strictEqual(result.content, "final answer");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({ messages: [new HumanMessage("user input")] }),
		};
		const result = await callReactAgent(agentMock, "user input", null);
		assert.strictEqual(result.content, "user input");
	});

	it("falls back to input message when all messages lack content", async () => {
		const agentMock = { invoke: () => ({ messages: [] }) };
		const result = await callReactAgent(agentMock, "fallback text", null);
		assert.strictEqual(result.content, "fallback text");
	});
});

describe("createReactAgent", () => {
	it("passes model and empty tools to langgraph createReactAgent", async () => {
		const agent = createReactAgent({ lc_kwargs: { model: "test" } });
		assert.ok(agent);
	});

	it("passes tools array to langgraph createReactAgent", async () => {
		const agent = createReactAgent({ lc_kwargs: { model: "test" } }, [{ name: "search" }]);
		assert.ok(agent);
	});
});

describe("callReactAgent streaming", () => {
	function createStream(events) {
		let idx = 0;
		const self = {
			[Symbol.asyncIterator]() {
				const iterator = {
					next: () => {
						if (idx < events.length) {
							return Promise.resolve({ value: events[idx++], done: false });
						}
						return Promise.resolve({ done: true });
					},
				};
				return iterator;
			},
		};
		return self;
	}

	function createMock(streamEventsResult) {
		return {
			streamEvents: () => streamEventsResult,
		};
	}

	it("calls callback with text event for each token delta", async () => {
		const events = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "Hello" },
					},
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
				},
			},
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "search", toolCallId: "1" } },
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hello", null, null, callback);
		assert.strictEqual(callbackCalls.length, 4);
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
		const events = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "   hello" },
					},
				},
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "fallback", null, null, callback);
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "hello");
		assert.strictEqual(result.content, "   hello");
	});

	it("callback receives tool events from protocol stream", async () => {
		const events = [
			{ method: "updates", params: { data: { node: "agent" } } },
			{
				method: "tools",
				params: {
					data: { event: "tool-started", tool_name: "read_file", tool_call_id: "abc-123" },
				},
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool-finished",
						tool_name: "read_file",
						tool_call_id: "abc-123",
						output: "file contents",
					},
				},
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool-error",
						tool_name: "write_file",
						tool_call_id: "xyz-456",
						message: "permission denied",
					},
				},
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "test", null, null, callback);
		} catch (err) {
			caughtError = err;
		}
		assert.strictEqual(callbackCalls.length, 3);
		assert.strictEqual(callbackCalls[0].type, "tool_start");
		assert.strictEqual(callbackCalls[0].toolName, "read_file");
		assert.strictEqual(callbackCalls[1].type, "tool_end");
		assert.strictEqual(callbackCalls[1].toolName, "read_file");
		assert.strictEqual(callbackCalls[1].data, "file contents");
		assert.strictEqual(callbackCalls[2].type, "tool_error");
		assert.strictEqual(callbackCalls[2].toolName, "write_file");
		assert.strictEqual(callbackCalls[2].error, "permission denied");
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});

	it("throws when no text content", async () => {
		const agentMock = {
			streamEvents: () => createStream([]),
		};

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "fallback", null, null, () => {});
		} catch (err) {
			caughtError = err;
		}
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});

	it("callback not called when no streaming callback provided", async () => {
		const agentMock = { invoke: () => ({ messages: [new AIMessage("full response")] }) };
		const result = await callReactAgent(agentMock, "ask", null, "system");
		assert.strictEqual(result.content, "full response");
	});

	it("handles text from event chunks", async () => {
		const events = [
			{
				method: "messages",
				params: {
					data: {
						event: "content-block-delta",
						index: 0,
						delta: { type: "text-delta", text: "sync text" },
					},
				},
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hi", null, null, callback);
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "sync text");
		assert.strictEqual(result.content, "sync text");
	});

	it("handles tool_event emission from partial_result events", async () => {
		const events = [
			{
				method: "tools",
				params: { data: { event: "tool-output-delta", tool_call_id: "1", delta: "step 1 done" } },
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "test", null, null, callback);
		} catch (err) {
			caughtError = err;
		}
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "tool_event");
		assert.strictEqual(callbackCalls[0].data, "step 1 done");
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});

	it("skips events when no text chunks", async () => {
		const agentMock = { streamEvents: () => createStream([]) };
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "fallback", null, null, callback);
		} catch (err) {
			caughtError = err;
		}
		assert.strictEqual(callbackCalls.length, 0);
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});

	it("survives callback throwing during tool events", async () => {
		const events = [
			{
				method: "tools",
				params: { data: { event: "tool-started", tool_name: "search", tool_call_id: "1" } },
			},
		];
		const agentMock = createMock(createStream(events));

		const callbackCalls = [];
		const callback = (event) => {
			callbackCalls.push(event);
			throw new Error("callback crashed");
		};

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "original", null, null, callback);
		} catch (err) {
			caughtError = err;
		}
		assert.strictEqual(callbackCalls.length, 1);
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});

	it("does not hang when no text from streaming", async () => {
		const startTime = Date.now();
		const events = [
			{
				method: "tools",
				params: {
					data: { event: "tool-started", tool_name: "web_search", tool_call_id: "tool-1" },
				},
			},
			{
				method: "tools",
				params: {
					data: {
						event: "tool-finished",
						tool_name: "web_search",
						tool_call_id: "tool-1",
						output: "result",
					},
				},
			},
		];

		const agentMock = createMock(createStream(events));
		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		let caughtError = null;
		try {
			await callReactAgent(agentMock, "use web_search", null, null, callback);
		} catch (err) {
			caughtError = err;
		}

		const elapsed = Date.now() - startTime;
		assert.ok(elapsed < 2000, `Streaming hung for ${elapsed}ms`);
		assert.strictEqual(callbackCalls.length, 2);
		assert.strictEqual(callbackCalls[0].type, "tool_start");
		assert.strictEqual(callbackCalls[1].type, "tool_end");
		assert.ok(caughtError instanceof Error);
		assert.ok(caughtError.message.includes("No response from agent"));
	});
});
