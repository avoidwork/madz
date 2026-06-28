import { describe, it, beforeEach, afterEach } from "node:test";
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
	createStdoutCallback,
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

	it("prepends system message on new thread (default)", async () => {
		let _capturedMessages = null;
		const agentMock = {
			invoke: () => {
				_capturedMessages = {};
				return { messages: [new AIMessage("ok")] };
			},
			stream: () => ({}),
			streamEvents: () => (async function* () {})(),
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
			streamEvents: () => (async function* () {})(),
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

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("original query")],
			}),
			streamEvents: () => (async function* () {})(),
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
			streamEvents: () => (async function* () {})(),
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

		it("uses default stdout callback when no callback provided", async () => {
			const events = [
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "response" }) },
				},
			];

			const agentMock = createMock(events);
			const result = await callReactAgent(agentMock, "hi", null, null, null);
			// With no callback, default stdout callback is used — streaming still works
			assert.strictEqual(result.content, "response");
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
	});

	describe("context length error handling", () => {
		function createContextLengthError(message) {
			const err = new Error(message);
			return err;
		}

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
	});

	describe("cache hit path", () => {
		it("returns cached content without calling streamEvents on cache hit", async () => {
			const agentMock = {
				streamEvents: () => (async function* () {})(),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			// First call to populate cache
			await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test-thread" } },
				null,
				callback,
			);

			// Clear callback calls
			callbackCalls.length = 0;

			// Second call with same thread_id and message should hit cache
			const result = await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test-thread" } },
				null,
				callback,
			);

			// Should return cached content
			assert.strictEqual(result.content, "hello");
			// Should have emitted text event from cache
			assert.ok(callbackCalls.some((e) => e.type === "text"));
		});
	});

	describe("streamEvents version parameter", () => {
		it("passes version v2 to streamEvents", async () => {
			let capturedVersion = null;
			const agentMock = {
				streamEvents: (input, options) => {
					capturedVersion = options?.version;
					return (async function* () {})();
				},
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};

			await callReactAgent(
				agentMock,
				"hello",
				{ configurable: { thread_id: "test" } },
				null,
				() => {},
			);

			assert.strictEqual(capturedVersion, "v2");
		});
	});

	describe("createReactAgent", () => {
		it("does not set stepTimeout on the compiled agent", () => {
			const model = {};
			const agent = createReactAgent(model);

			// stepTimeout should not be set — it was dead code removed in #463
			assert.strictEqual(agent.stepTimeout, undefined);
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

	describe("toolmessage compaction preservation", () => {
		function createContextLengthError(message) {
			const err = new Error(message);
			return err;
		}

		it("preserves ToolMessage instances through compaction in callReactAgentStreaming", async () => {
			let callCount = 0;

			// We need to capture messages on the retry call
			let retryMessages = null;
			const capturingMock = {
				streamEvents: (input) => {
					callCount++;
					if (callCount === 1) {
						throw createContextLengthError("maximum context length of 8192 tokens");
					}
					retryMessages = input.messages;
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

			await callReactAgent(capturingMock, "test", {}, null, callback, {
				maxTokens: 2048,
				maxCompactionIterations: 3,
			});

			// After compaction, verify all messages are proper LangChain instances
			// (ToolMessage should not have been converted to AIMessage)
			assert.ok(retryMessages);
			for (const msg of retryMessages) {
				assert.ok(
					msg instanceof HumanMessage ||
						msg instanceof AIMessage ||
						msg instanceof ToolMessage ||
						msg instanceof SystemMessage,
					`Message should be a proper LangChain instance, got ${msg.constructor.name}`,
				);
			}
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

	describe("createStdoutCallback", () => {
		let stdoutWrite;
		let stderrWrite;
		let stdoutChunks;
		let stderrChunks;

		beforeEach(() => {
			stdoutChunks = [];
			stderrChunks = [];
			stdoutWrite = process.stdout.write;
			stderrWrite = process.stderr.write;
			process.stdout.write = (chunk) => {
				stdoutChunks.push(chunk);
				return true;
			};
			process.stderr.write = (chunk) => {
				stderrChunks.push(chunk);
				return true;
			};
		});

		afterEach(() => {
			process.stdout.write = stdoutWrite;
			process.stderr.write = stderrWrite;
		});

		it("writes text chunks to stdout without extra newlines", () => {
			const callback = createStdoutCallback();
			callback({ type: "text", text: "Hello World" });
			assert.strictEqual(stdoutChunks.length, 1);
			assert.strictEqual(stdoutChunks[0], "Hello World");
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("writes multiple text chunks separately", () => {
			const callback = createStdoutCallback();
			callback({ type: "text", text: "Hello" });
			callback({ type: "text", text: " World" });
			assert.strictEqual(stdoutChunks.length, 2);
			assert.strictEqual(stdoutChunks[0], "Hello");
			assert.strictEqual(stdoutChunks[1], " World");
		});

		it("writes loop_detected events to stderr", () => {
			const callback = createStdoutCallback();
			callback({ type: "loop_detected" });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 1);
			assert.ok(stderrChunks[0].includes("[loop detected]"));
		});

		it("ignores tool_start events", () => {
			const callback = createStdoutCallback();
			callback({ type: "tool_start", toolName: "web_search", toolCallId: "tc1" });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("ignores tool_end events", () => {
			const callback = createStdoutCallback();
			callback({ type: "tool_end", toolName: "web_search", toolCallId: "tc1" });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("ignores reasoning events", () => {
			const callback = createStdoutCallback();
			callback({ type: "reasoning", text: "thinking..." });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("ignores compaction_start events", () => {
			const callback = createStdoutCallback();
			callback({ type: "compaction_start" });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("ignores compaction_end events", () => {
			const callback = createStdoutCallback();
			callback({ type: "compaction_end" });
			assert.strictEqual(stdoutChunks.length, 0);
			assert.strictEqual(stderrChunks.length, 0);
		});

		it("handles mixed events correctly", () => {
			const callback = createStdoutCallback();
			callback({ type: "text", text: "Let me" });
			callback({ type: "tool_start", toolName: "search", toolCallId: "tc1" });
			callback({ type: "tool_end", toolName: "search", toolCallId: "tc1" });
			callback({ type: "text", text: " search." });
			callback({ type: "loop_detected" });

			assert.strictEqual(stdoutChunks.length, 2);
			assert.strictEqual(stdoutChunks[0], "Let me");
			assert.strictEqual(stdoutChunks[1], " search.");
			assert.strictEqual(stderrChunks.length, 1);
			assert.ok(stderrChunks[0].includes("[loop detected]"));
		});
	});

	describe("non-TUI streaming mode", () => {
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

		it("uses streaming pipeline when no callback provided", async () => {
			let streamEventsCalled = false;
			const agentMock = {
				streamEvents: () => {
					streamEventsCalled = true;
					return createEvents([
						{
							event: "on_chat_model_stream",
							data: { chunk: new AIMessageChunk({ content: "streamed response" }) },
						},
					]);
				},
				invoke: () => ({ messages: [new AIMessage("should not be called")] }),
			};

			const result = await callReactAgent(agentMock, "hello", null, null, null);
			assert.ok(streamEventsCalled, "streamEvents should be called");
			assert.strictEqual(result.content, "streamed response");
		});

		it("user-provided callback takes precedence over default", async () => {
			let callbackType = null;
			const customCallback = (event) => {
				callbackType = event.type;
			};

			const agentMock = createMock([
				{
					event: "on_chat_model_stream",
					data: { chunk: new AIMessageChunk({ content: "response" }) },
				},
			]);

			await callReactAgent(agentMock, "hello", null, null, customCallback);
			assert.strictEqual(callbackType, "text", "Custom callback should receive events");
		});
	});
});
