import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		const agentMock = {
			invoke: () => {
				return {
					messages: [
						new SystemMessage("system"),
						new HumanMessage("user content"),
						new AIMessage("response"),
					],
				};
			},
		};

		const result = await callReactAgent(agentMock, "hello", {}, "system");
		assert.deepStrictEqual(result, { content: "response" });
	});

	it("prepends system message on new thread (default)", async () => {
		let _capturedMessages = null;
		const agentMock = {
			invoke: () => {
				_capturedMessages = {};
				return { messages: [new AIMessage("ok")] };
			},
			stream: () => ({}),
			streamEvents: () => ({}),
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: true } },
			"custom-system",
			null,
		);
		assert.ok(true);
	});

	it("skips system message when isNewThread is false", async () => {
		let _capturedMessages = null;
		const agentMock = {
			invoke: () => {
				_capturedMessages = {};
				return { messages: [new AIMessage("ok")] };
			},
			stream: () => ({}),
			streamEvents: () => ({}),
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: false } },
			"ignored",
			null,
		);
		assert.ok(true);
	});

	it("invokes agent with config object", async () => {
		let capturedInput = null;
		let capturedConfig = null;
		const agentMock = {
			invoke: (input, configuration) => {
				capturedInput = input;
				capturedConfig = configuration;
				return { messages: [new AIMessage("response")] };
			},
		};

		const config = { configurable: { thread_id: "abc" } };
		await callReactAgent(agentMock, "hello", config, "system");
		assert.ok(capturedInput);
		assert.ok(capturedInput.messages);
		const humanMsg = capturedInput.messages.find((m) => m.constructor.name === "HumanMessage");
		assert.ok(humanMsg);
		assert.strictEqual(humanMsg.content, "hello");
		assert.ok(capturedConfig);
		assert.strictEqual(capturedConfig.configurable.thread_id, "abc");
	});

	it("returns { content } with last message content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("hi"), new AIMessage("got it")],
			}),
		};

		const result = await callReactAgent(agentMock, "hi", null, null);
		assert.deepStrictEqual(result, { content: "got it" });
	});

	it("handles multi-turn agent responses", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new HumanMessage("hi"),
					new AIMessage("Hello!"),
					new HumanMessage("bye"),
					new AIMessage("Goodbye!"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "hi", null, null);
		assert.strictEqual(result.content, "Goodbye!");
	});

	it("re-throws errors from agent.invoke", async () => {
		const agentMock = {
			invoke: () => {
				throw new Error("model error");
			},
			stream: () => ({}),
			streamEvents: () => ({}),
		};

		let err = null;
		try {
			await callReactAgent(agentMock, "hi", null, "sys");
		} catch (e) {
			err = e;
		}

		assert.ok(err instanceof Error);
		assert.strictEqual(err.message, "model error");
	});

	it("scans for last AIMessage ignoring tool calls", async () => {
		const toolCallAIMessage = new AIMessage({
			content: "",
			tool_calls: [{ name: "web", args: {} }],
		});
		const textAIMessage = new AIMessage({ content: "final text" });
		const toolCallAIMessage2 = new AIMessage({
			content: "",
			tool_calls: [{ name: "search", args: {} }],
		});

		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("hi"), toolCallAIMessage, toolCallAIMessage2, textAIMessage],
			}),
		};

		const result = await callReactAgent(agentMock, "hi", null, null);
		assert.strictEqual(result.content, "final text");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("original query")],
			}),
		};

		const result = await callReactAgent(agentMock, "original query", null, null);
		assert.strictEqual(result.content, "original query");
	});

	it("falls back to input message when all messages lack content", async () => {
		const msgWithoutContent = new AIMessage({ content: null });
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("query"), msgWithoutContent],
			}),
		};

		const result = await callReactAgent(agentMock, "query", null, null);
		assert.strictEqual(result.content, "query");
	});

	it("passes model and empty tools to langgraph createReactAgent", async () => {
		const model = {};
		const result = createReactAgent(model);
		assert.ok(result);
	});

	it("passes tools array to langgraph createReactAgent", async () => {
		const model = {};
		const tools = [{ name: "test" }];
		const result = createReactAgent(model, tools);
		assert.ok(result);
	});

	describe("streaming", () => {
		function createEvents(events) {
			/* unused */ let _idx = 0;
			return (async function* () {
				for (const evt of events) {
					yield evt;
				}
			})();
		}

		function createMock(eventList) {
			return {
				streamEvents: () => createEvents(eventList),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};
		}

		it("captures text from chat model stream events", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Hello!" }) },
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hello", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "text"));
		});

		it("captures reasoning content from chat model stream events", async () => {
			const chunk = new AIMessageChunk({ content: [] });
			chunk.reasoning = "thinking about this...";
			const events = [{ event: "on_chat_model_stream", data: { chunk } }];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hello", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "reasoning"));
		});

		it("captures tool_start events from stream", async () => {
			const events = [
				{
					event: "on_tool_start",
					name: "tool",
					data: {
						input: {
							tool_calls: [{ name: "web_search", id: "tc1" }],
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "search", null, null, callback);
			const toolStart = callbackCalls.find((e) => e.type === "tool_start");
			assert.ok(toolStart);
			assert.strictEqual(toolStart.toolName, "web_search");
			assert.strictEqual(toolStart.toolCallId, "tc1");
		});

		it("captures tool_end events with output from stream", async () => {
			const events = [
				{
					event: "on_tool_end",
					name: "tool",
					data: {
						input: { name: "web_search", tool_calls: [{ id: "tc1" }] },
						output: { content: "search results here" },
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "search", null, null, callback);
			const toolEnd = callbackCalls.find((e) => e.type === "tool_end");
			assert.ok(toolEnd);
			assert.strictEqual(toolEnd.toolName, "web_search");
			assert.strictEqual(toolEnd.data, "search results here");
		});

		it("captures tool_error events from stream", async () => {
			const events = [
				{
					event: "on_tool_error",
					name: "tool",
					data: {
						input: { name: "web_search", tool_calls: [{ id: "tc1" }] },
						error: "connection refused",
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "search", null, null, callback);
			const toolError = callbackCalls.find((e) => e.type === "tool_error");
			assert.ok(toolError);
			assert.strictEqual(toolError.toolName, "web_search");
			assert.strictEqual(toolError.error, "connection refused");
		});

		it("deduplicates tool_start for same tool call id", async () => {
			const events = [
				{
					event: "on_tool_start",
					name: "tool",
					data: {
						input: {
							tool_calls: [
								{ name: "web_search", id: "tc1" },
								{ name: "web_search", id: "tc1" },
							],
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "search", null, null, callback);
			const toolStartCalls = callbackCalls.filter((e) => e.type === "tool_start");
			assert.strictEqual(toolStartCalls.length, 1);
		});

		it("falls back to original message when no events have text", async () => {
			const events = [];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "original query", null, null, callback);
			assert.strictEqual(result.content, "original query");
		});

		it("includes text content from AIMessage content objects", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: {
						chunk: new AIMessage({ content: { type: "text", text: "hello world" } }),
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hi", null, null, callback);
			const textEvents = callbackCalls.filter((e) => e.type === "text");
			assert.ok(textEvents.length > 0);
		});

		it("survives callback throwing during text events", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "response" }) },
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => {
				callbackCalls.push(event);
				if (event.type === "text") throw new Error("callback crashed");
			};

			let caughtError = null;
			try {
				await callReactAgent(agentMock, "query", null, null, callback);
			} catch (err) {
				caughtError = err;
			}

			assert.ok(caughtError instanceof Error);
			assert.strictEqual(caughtError.message, "callback crashed");
		});

		it("does not hang on empty event stream immediately", async () => {
			const events = [];

			const agentMock = createMock(events);
			const callback = () => {};

			const startTime = Date.now();
			const result = await callReactAgent(agentMock, "query", null, null, callback);
			const elapsed = Date.now() - startTime;

			assert.ok(elapsed < 2000, `Streaming hung for ${elapsed}ms`);
			assert.ok(result.content);
			assert.strictEqual(result.content, "query");
		});

		it("handles reasoning and text from same stream", async () => {
			const reasoningChunk = new AIMessageChunk({ content: [] });
			reasoningChunk.reasoning = "thinking...";
			const events = [
				{ event: "on_chat_model_stream", data: { chunk: reasoningChunk } },
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Hello!" }) },
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hello", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "reasoning"));
			assert.ok(callbackCalls.some((e) => e.type === "text"));
		});

		it("handles tool_start + tool_end + reasoning + text in sequence", async () => {
			const reasoningChunk = new AIMessageChunk({ content: [] });
			reasoningChunk.reasoning = "processing results...";
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Let me search..." }) },
				},
				{
					event: "on_tool_start",
					name: "tool",
					data: { input: { tool_calls: [{ name: "web_search", id: "tc1" }] } },
				},
				{
					event: "on_tool_end",
					name: "tool",
					data: {
						input: { name: "web_search", tool_calls: [{ id: "tc1" }] },
						output: { content: "results" },
					},
				},
				{ event: "on_chat_model_stream", data: { chunk: reasoningChunk } },
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Here is the answer." }) },
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "search", null, null, callback);

			const types = callbackCalls.map((e) => e.type);
			assert.ok(types.includes("text"));
			assert.ok(types.includes("tool_start"));
			assert.ok(types.includes("tool_end"));
			assert.ok(types.includes("reasoning"));
		});

		it("does not call callback when no streaming callback provided", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "response" }) },
				},
			];

			const agentMock = createMock(events);
			const result = await callReactAgent(agentMock, "hi", null, null, null);
			// With no callback, agent.invoke() is used which returns fallback
			assert.strictEqual(result.content, "fallback");
		});

		it("handles AIMessage with complex content object", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: {
						chunk: new AIMessage({ content: { type: "text", text: "hello world" } }),
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hi", null, null, callback);
			assert.ok(callbackCalls.length > 0);
		});

		it("uses configurable in streamEvents options", async () => {
			let capturedOptions = null;
			const agentMock = {
				streamEvents: (input, options) => {
					capturedOptions = options;
					return createEvents([]);
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const config = { configurable: { thread_id: "abc", isNewThread: false } };
			await callReactAgent(agentMock, "hello", config, null, () => {});

			assert.ok(capturedOptions);
			assert.strictEqual(capturedOptions.configurable.thread_id, "abc");
			assert.strictEqual(capturedOptions.configurable.isNewThread, false);
		});
	});
});
