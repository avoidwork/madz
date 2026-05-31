import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [
					new SystemMessage("system"),
					new HumanMessage("user content"),
					new AIMessage("response"),
				],
			}),
		};

		const result = await callReactAgent(agentMock, "hello", {}, "system");
		assert.strictEqual(result.content, "response");
	});

	it("prepends system message on new thread (default)", async () => {
		let capturedConfig = null;
		const agentMock = {
			invoke: (input) => {
				capturedConfig = input;
				return { messages: [new AIMessage("ok")] };
			},
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: true } },
			"custom-system",
			null,
		);
		assert.ok(capturedConfig.configurable.isNewThread === true);
	});

	it("skips system message when isNewThread is false", async () => {
		let capturedConfig = null;
		const agentMock = {
			invoke: (input) => {
				capturedConfig = input;
				return { messages: [new AIMessage("ok")] };
			},
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: false } },
			"ignored",
			null,
		);
		assert.strictEqual(capturedConfig.configurable.isNewThread, false);
	});

	it("invokes agent with config object", async () => {
		let capturedConfig = null;
		const agentMock = {
			invoke: (input) => {
				capturedConfig = input;
				return { messages: [new AIMessage("response")] };
			},
		};

		const config = { configurable: { thread_id: "abc" } };
		await callReactAgent(agentMock, "hello", config, "system");
		assert.ok(capturedConfig);
		assert.ok(capturedConfig.messages);
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
		function createStreamEvents(protocolEvents) {
			let idx = 0;
			return {
				[Symbol.asyncIterator]() {
					return {
						next: () => {
							if (idx < protocolEvents.length) {
								return Promise.resolve({
									value: protocolEvents[idx++],
									done: false,
								});
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			};
		}

		function createMock(protocolEvents) {
			return {
				streamEvents: (_input, _options) => createStreamEvents(protocolEvents),
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};
		}

		it("captures text from ProtocolEvent deltas", async () => {
			const events = [
				{
					method: "messages",
					params: {
						data: {
							event: "content-block-delta",
							delta: "Hello!",
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "hello", null, null, callback);
			assert.strictEqual(callbackCalls.length, 1);
			assert.strictEqual(callbackCalls[0].type, "text");
			assert.strictEqual(callbackCalls[0].text, "Hello!");
			assert.strictEqual(result.content, "Hello!");
		});

		it("captures tool calls from ProtocolEvents", async () => {
			const events = [
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "web_search",
							tool_call_id: "tc1",
						},
					},
				},
				{
					method: "tools",
					params: {
						data: {
							event: "tool-finished",
							tool_name: "web_search",
							tool_call_id: "tc1",
							output: "done",
						},
					},
				},
				{
					method: "messages",
					params: {
						data: {
							event: "content-block-delta",
							delta: "Search done.",
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "search", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "tool_start" && e.toolName === "web_search"));
			assert.ok(callbackCalls.some((e) => e.type === "text"));
			assert.ok(callbackCalls.some((e) => e.type === "tool_end" && e.toolName === "web_search"));
			assert.strictEqual(result.content, "Search done.");
		});

		it("does not duplicate tool_start callbacks for same tool call", async () => {
			const events = [
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "web_search",
							tool_call_id: "tc1",
						},
					},
				},
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "web_search",
							tool_call_id: "tc1",
						},
					},
				},
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "web_search",
							tool_call_id: "tc1",
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "query", null, null, callback);
			const toolStartCalls = callbackCalls.filter((e) => e.type === "tool_start");
			assert.strictEqual(toolStartCalls.length, 1);
		});

		it("falls back to input when no captured content", async () => {
			const events = [
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "search",
							tool_call_id: "tc1",
						},
					},
				},
				{
					method: "tools",
					params: {
						data: {
							event: "tool-finished",
							tool_name: "search",
							tool_call_id: "tc1",
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			let caughtError = null;
			try {
				const result = await callReactAgent(agentMock, "query", null, null, callback);
				caughtError = result;
			} catch (err) {
				caughtError = err;
			}

			assert.ok(caughtError);
			assert.ok(caughtError.content);
			assert.strictEqual(caughtError.content, "query");
		});

		it("callback not called when no streaming callback provided", async () => {
			const agentMock = createMock([]);
			const result = await callReactAgent(agentMock, "hi", null, null, null);
			assert.strictEqual(result.content, "fallback");
		});

		it("handles callback throwing during text events", async () => {
			const events = [
				{
					method: "messages",
					params: {
						data: {
							event: "content-block-delta",
							delta: "response",
						},
					},
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

		it("does not hang on empty ProtocolEvents", async () => {
			const agentMock = createMock([]);
			const startTime = Date.now();
			const callback = () => {};

			const result = await callReactAgent(agentMock, "query", null, null, callback);

			const elapsed = Date.now() - startTime;
			assert.ok(elapsed < 2000, `Streaming hung for ${elapsed}ms`);
			assert.ok(result.content);
			assert.strictEqual(result.content, "query");
		});

		it("handles tool_error events", async () => {
			const events = [
				{
					method: "tools",
					params: {
						data: {
							event: "tool-started",
							tool_name: "write_file",
							tool_call_id: "tc1",
						},
					},
				},
				{
					method: "tools",
					params: {
						data: {
							event: "tool-error",
							tool_name: "write_file",
							tool_call_id: "tc1",
							error: "permission denied",
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "query", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "tool_error" && e.toolName === "write_file"));
			assert.ok(
				callbackCalls.some((e) => e.type === "tool_error" && e.error === "permission denied"),
			);
		});

		it("handles tool_output on_tool_event data passthrough", async () => {
			const events = [
				{
					method: "tools",
					params: {
						data: {
							event: "on_tool_event",
							tool_call_id: "tc1",
							data: { step: 1, content: "partial" },
						},
					},
				},
			];

			const agentMock = createMock(events);
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			await callReactAgent(agentMock, "query", null, null, callback);
			assert.ok(callbackCalls.some((e) => e.type === "tool_event"));
			assert.strictEqual(callbackCalls[0].data.step, 1);
			assert.strictEqual(callbackCalls[0].data.content, "partial");
		});
	});
});
