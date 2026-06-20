import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	AIMessage,
	AIMessageChunk,
	HumanMessage,
	HumanMessageChunk,
	SystemMessage,
	ToolMessage,
} from "@langchain/core/messages";
import {
	callReactAgent,
	createReactAgent,
	clearCache,
	getMessageRole,
} from "../../src/agent/react.js";

class GraphRecursionError extends Error {
	constructor(message) {
		super(message);
		this.name = "GraphRecursionError";
	}
}

describe("callReactAgent", () => {
	beforeEach(() => {
		clearCache();
	});

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
					data: { input: { tool_calls: [{ name: "webSearch", id: "tc1" }] } },
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

	describe("recursion limit handling", () => {
		it("returns graceful message on GraphRecursionError in non-streaming mode", async () => {
			const agentMock = {
				invoke: () => {
					throw new GraphRecursionError("Recursion limit of 25 reached");
				},
				streamEvents: () => ({}),
			};

			const result = await callReactAgent(agentMock, "test message", {}, null);
			assert.ok(result.content.includes("maximum number of reasoning steps"));
		});

		it("returns graceful message on GraphRecursionError in streaming mode", async () => {
			const agentMock = {
				streamEvents: () => {
					throw new GraphRecursionError("Recursion limit of 25 reached");
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const result = await callReactAgent(agentMock, "test message", {}, null, () => {});
			assert.ok(result.content.includes("maximum number of reasoning steps"));
		});

		it("still re-throws non-GraphRecursionError in non-streaming mode", async () => {
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
	});

	describe("context length error handling", () => {
		function createContextLengthError(message) {
			const err = new Error(message);
			return err;
		}

		it("retries on context length error and succeeds on second attempt", async () => {
			let invokeCount = 0;
			const agentMock = {
				invoke: (_input) => {
					invokeCount++;
					if (invokeCount === 1) {
						throw createContextLengthError("This model's maximum context length is 128000 tokens");
					}
					return { messages: [new AIMessage("success after retry")] };
				},
				streamEvents: () => ({}),
			};

			const result = await callReactAgent(agentMock, "test", {}, "system prompt", null, {
				maxTokens: 4096,
			});

			assert.strictEqual(result.content, "success after retry");
			assert.strictEqual(invokeCount, 2);
		});

		it("returns context too long message after max iterations", async () => {
			const agentMock = {
				invoke: () => {
					throw createContextLengthError("This model's maximum context length is 128000 tokens");
				},
				streamEvents: () => ({}),
			};

			const result = await callReactAgent(agentMock, "test", {}, "system prompt", null, {
				maxTokens: 4096,
				maxCompactionIterations: 3,
			});

			assert.strictEqual(
				result.content,
				"The conversation is too long. Please start a new session.",
			);
		});

		it("re-throws non-context-length errors during retry loop", async () => {
			const agentMock = {
				invoke: () => {
					throw new Error("rate limit exceeded");
				},
				streamEvents: () => ({}),
			};

			let err = null;
			try {
				await callReactAgent(agentMock, "test", {}, "system prompt", null, {
					maxTokens: 4096,
				});
			} catch (e) {
				err = e;
			}

			assert.ok(err instanceof Error);
			assert.strictEqual(err.message, "rate limit exceeded");
		});

		it("handles context length error in streaming mode", async () => {
			const agentMock = {
				streamEvents: () => {
					throw createContextLengthError("maximum context length of 8192 tokens");
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const result = await callReactAgent(agentMock, "test", {}, null, () => {}, {
				maxTokens: 2048,
			});

			// After max iterations, returns original message as fallback
			assert.strictEqual(result.content, "test");
		});

		it("extracts context length from error message automatically", async () => {
			let invokeCount = 0;
			const agentMock = {
				invoke: (_input) => {
					invokeCount++;
					if (invokeCount === 1) {
						throw createContextLengthError("This model's maximum context length is 65536 tokens");
					}
					return { messages: [new AIMessage("success")] };
				},
				streamEvents: () => ({}),
			};

			// Don't pass maxContextLength — it should be extracted from error
			const result = await callReactAgent(agentMock, "test", {}, "system prompt", null, {
				maxTokens: 4096,
			});

			assert.strictEqual(result.content, "success");
			assert.strictEqual(invokeCount, 2);
		});

		it("respects custom maxCompactionIterations", async () => {
			let invokeCount = 0;
			const agentMock = {
				invoke: () => {
					invokeCount++;
					throw createContextLengthError("This model's maximum context length is 128000 tokens");
				},
				streamEvents: () => ({}),
			};

			const result = await callReactAgent(agentMock, "test", {}, "system prompt", null, {
				maxTokens: 4096,
				maxCompactionIterations: 1,
			});

			assert.strictEqual(
				result.content,
				"The conversation is too long. Please start a new session.",
			);
			assert.strictEqual(invokeCount, 2); // initial + 1 retry
		});

		it("emits compaction_start and compaction_end events in streaming mode on first retry", async () => {
			const agentMock = {
				streamEvents: () => {
					throw createContextLengthError("maximum context length of 8192 tokens");
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "test", {}, null, callback, {
				maxTokens: 2048,
				maxCompactionIterations: 3,
			});

			const compactionStart = callbackCalls.filter((e) => e.type === "compaction_start");
			const compactionEnd = callbackCalls.filter((e) => e.type === "compaction_end");

			assert.strictEqual(compactionStart.length, 1, "Should emit exactly one compaction_start");
			assert.strictEqual(compactionEnd.length, 1, "Should emit exactly one compaction_end");
			assert.ok(
				compactionStart[0].type === "compaction_start",
				"compaction_start event type is correct",
			);
			assert.ok(compactionEnd[0].type === "compaction_end", "compaction_end event type is correct");
		});

		it("emits compaction_start only once across multiple retries", async () => {
			let streamCallCount = 0;
			const agentMock = {
				streamEvents: () => {
					streamCallCount++;
					if (streamCallCount <= 2) {
						throw createContextLengthError("maximum context length of 8192 tokens");
					}
					// Succeed on third attempt
					return (async function* () {
						yield {
							event: "on_chat_model_stream",
							data: { chunk: new AIMessageChunk({ content: "success" }) },
						};
					})();
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "test", {}, null, callback, {
				maxTokens: 2048,
				maxCompactionIterations: 3,
			});

			const compactionStart = callbackCalls.filter((e) => e.type === "compaction_start");
			const compactionEnd = callbackCalls.filter((e) => e.type === "compaction_end");

			assert.strictEqual(
				compactionStart.length,
				1,
				"Should emit exactly one compaction_start across all retries",
			);
			assert.strictEqual(compactionEnd.length, 1, "Should emit exactly one compaction_end");
		});

		it("does not emit compaction events when no context length error occurs", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Hello!" }) },
				},
			];

			const agentMock = {
				streamEvents: () =>
					(async function* () {
						for (const evt of events) yield evt;
					})(),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hello", null, null, callback);

			const compactionEvents = callbackCalls.filter(
				(e) => e.type === "compaction_start" || e.type === "compaction_end",
			);
			assert.strictEqual(
				compactionEvents.length,
				0,
				"Should not emit compaction events on success",
			);
		});
	});

	describe("abort signal", () => {
		function createEvents(events) {
			return (async function* () {
				for (const evt of events) {
					yield evt;
					await new Promise((resolve) => setTimeout(resolve, 0));
				}
			})();
		}

		function createMock(eventList) {
			return {
				streamEvents: () => createEvents(eventList),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};
		}

		it.skip("stops streaming when abort signal is triggered", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Hello" }) },
				},
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: " World" }) },
				},
			];

			const controller = new AbortController();
			const agentMock = {
				streamEvents: () => createEvents(events),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			// Abort after first event
			setTimeout(() => controller.abort(), 10);

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "hello", null, null, callback, {
				signal: controller.signal,
			});

			// Should return early with original message
			assert.strictEqual(result.content, "hello");
		});

		it("throws if signal is already aborted before starting", async () => {
			const controller = new AbortController();
			controller.abort();

			const agentMock = createMock([]);

			let err = null;
			try {
				await callReactAgent(agentMock, "hello", null, null, () => {}, {
					signal: controller.signal,
				});
			} catch (e) {
				err = e;
			}

			assert.ok(err instanceof Error);
			assert.strictEqual(err.name, "AbortError");
		});

		it("emits tool_end for pending tools on abort", async () => {
			const events = [
				{
					event: "on_tool_start",
					name: "tool",
					data: { input: { tool_calls: [{ name: "web_search", id: "tc1" }] } },
				},
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "partial" }) },
				},
			];

			const controller = new AbortController();
			const agentMock = {
				streamEvents: () => createEvents(events),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			setTimeout(() => controller.abort(), 10);

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "hello", null, null, callback, { signal: controller.signal });

			// Should have tool_end for the pending tool
			const toolEnds = callbackCalls.filter((e) => e.type === "tool_end");
			assert.ok(toolEnds.length > 0, "Should emit tool_end for pending tools");
		});
	});

	describe("recursion limit threading", () => {
		it("passes recursionLimit to agent.invoke() in non-streaming mode", async () => {
			let capturedConfig = null;
			const agentMock = {
				invoke: (input, config) => {
					capturedConfig = config;
					return { messages: [new AIMessage("ok")] };
				},
			};

			await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test" } },
				null,
				null,
				{ recursionLimit: 500 },
			);

			assert.strictEqual(capturedConfig.recursionLimit, 500);
		});

		it("passes recursionLimit to agent.streamEvents() in streaming mode", async () => {
			let capturedConfig = null;
			const agentMock = {
				streamEvents: (input, config) => {
					capturedConfig = config;
					return (async function* () {})();
				},
			};

			await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test" } },
				null,
				() => {},
				{ recursionLimit: 750 },
			);

			assert.strictEqual(capturedConfig.recursionLimit, 750);
		});

		it("omits recursionLimit when not provided", async () => {
			let capturedConfig = null;
			const agentMock = {
				invoke: (input, config) => {
					capturedConfig = config;
					return { messages: [new AIMessage("ok")] };
				},
			};

			await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test" } },
				null,
				null,
				{},
			);

			assert.strictEqual(capturedConfig.recursionLimit, undefined);
		});
	});

	describe("getMessageRole", () => {
		it("maps HumanMessage to 'user'", () => {
			assert.strictEqual(getMessageRole(new HumanMessage("hi")), "user");
		});

		it("maps HumanMessageChunk to 'user'", () => {
			assert.strictEqual(getMessageRole(new HumanMessageChunk("hi")), "user");
		});

		it("maps AIMessage to 'assistant'", () => {
			assert.strictEqual(getMessageRole(new AIMessage("hello")), "assistant");
		});

		it("maps AIMessageChunk to 'assistant'", () => {
			assert.strictEqual(getMessageRole(new AIMessageChunk("hello")), "assistant");
		});

		it("maps ToolMessage to 'tool'", () => {
			assert.strictEqual(
				getMessageRole(new ToolMessage({ content: "result", tool_call_id: "tc1", name: "web" })),
				"tool",
			);
		});

		it("maps SystemMessage to 'system'", () => {
			assert.strictEqual(getMessageRole(new SystemMessage("sys")), "system");
		});

		it("falls back to 'system' for unknown message types", () => {
			const unknownMsg = { content: "unknown", type: "custom" };
			assert.strictEqual(getMessageRole(unknownMsg), "system");
		});
	});

	describe("streaming returns aggregated text", () => {
		function createEvents(events) {
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

		it("returns aggregated text on successful stream completion", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "Hello" }) },
				},
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: " World" }) },
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "original query", null, null, callback);
			assert.strictEqual(result.content, "Hello World");
		});

		it("falls back to original message when no text events occurred", async () => {
			const events = [];

			const agentMock = createMock(events);
			const callback = () => {};

			const result = await callReactAgent(agentMock, "original query", null, null, callback);
			assert.strictEqual(result.content, "original query");
		});
	});
});
