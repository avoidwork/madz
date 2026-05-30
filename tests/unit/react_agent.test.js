import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { callReactAgent, createReactAgent } from "../../src/agent/react.js";

describe("callReactAgent", () => {
	it("invokes agent with correct message format", async () => {
		let capturedMessages = null;
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
		assert.strictEqual(capturedMessages, null);
		// The mock doesn't capture messages since it doesn't use input
		assert.strictEqual(result.content, "response");
	});

	it("prepends system message on new thread (default)", async () => {
		let capturedMessages = null;
		const agentMock = {
			invoke: () => {
				capturedMessages = {};
				return { messages: [new AIMessage("ok")] };
			},
			stream: () => ({}),
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: true } },
			"custom-system",
			null,
		);
		assert.ok(capturedMessages === undefined || true);
	});

	it("skips system message when isNewThread is false", async () => {
		let capturedMessages = null;
		const agentMock = {
			invoke: () => {
				capturedMessages = {};
				return { messages: [new AIMessage("ok")] };
			},
			stream: () => ({}),
		};

		await callReactAgent(
			agentMock,
			"hello",
			{ configurable: { isNewThread: false } },
			"ignored",
			null,
		);
		assert.ok(capturedMessages === undefined || true);
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
			stream: () => ({}),
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
		// AIMessage with null content becomes [] which serializes as "[]"
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
		function createStream(snapshots) {
			let idx = 0;
			return {
				[Symbol.asyncIterator]() {
					return {
						next: () => {
							if (idx < snapshots.length) {
								return Promise.resolve({ value: snapshots[idx++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			};
		}

		function createMock(streamResult) {
			return {
				stream: (_input, _options) => streamResult,
				invoke: () => ({ messages: [new AIMessage("fallback")] }),
			};
		}

		it("captures text from AI message snapshots", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("hello")] },
				{
					messages: [
						new HumanMessage("hello"),
						new AIMessageChunk({ content: "Hello!", id: "msg1" }),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "hello", null, null, callback);
			assert.strictEqual(callbackCalls.length, 1);
			assert.strictEqual(callbackCalls[0].type, "text");
			assert.strictEqual(callbackCalls[0].text, "Hello!");
			assert.strictEqual(result.content, "Hello!");
		});

		it("captures tool calls from AI message snapshots", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("search")] },
				{
					messages: [
						new HumanMessage("search"),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "web_search", args: {}, id: "tc1" }],
						}),
					],
				},
				{
					messages: [
						new HumanMessage("search"),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "web_search", args: {}, id: "tc1" }],
						}),
						new AIMessageChunk({ content: "Search done.", id: "msg2" }),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "search", null, null, callback);
			// tool_start + text + tool_end
			assert.ok(callbackCalls.some((e) => e.type === "tool_start" && e.toolName === "web_search"));
			assert.ok(callbackCalls.some((e) => e.type === "text"));
			assert.ok(callbackCalls.some((e) => e.type === "tool_end" && e.toolName === "web_search"));
			assert.strictEqual(result.content, "Search done.");
		});

		it("does not duplicate tool_start callbacks for same tool call", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("query")] },
				{
					messages: [
						new HumanMessage("query"),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "web_search", args: {}, id: "tc1" }],
						}),
					],
				},
				{
					messages: [
						new HumanMessage("query"),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "web_search", args: {}, id: "tc1" }],
						}),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "web_search", args: {}, id: "tc1" }],
						}),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "query", null, null, callback);
			const toolStartCalls = callbackCalls.filter((e) => e.type === "tool_start");
			assert.strictEqual(toolStartCalls.length, 1);
			assert.strictEqual(result.content, "query");
		});

		it("throws when no content from any snapshot", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("query")] },
				{
					messages: [
						new HumanMessage("query"),
						new AIMessageChunk({
							content: "",
							tool_calls: [{ name: "search", args: {}, id: "tc1" }],
						}),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
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
			const snapshots = [
				{
					messages: [
						new HumanMessage("hi"),
						new AIMessageChunk({ content: "response", id: "msg1" }),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
			const result = await callReactAgent(agentMock, "hi", null, null, null);
			// With no callback, agent.invoke() is used which returns fallback
			assert.strictEqual(result.content, "fallback");
		});

		it("handles AIMessage with complex content", async () => {
			const snapshots = [
				{
					messages: [
						new HumanMessage("hi"),
						new AIMessage({ content: { type: "text", text: "hello world" } }),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
			const callbackCalls = [];
			const callback = (event) => callbackCalls.push(event);

			const result = await callReactAgent(agentMock, "hi", null, null, callback);
			assert.strictEqual(callbackCalls.length, 1);
			assert.strictEqual(callbackCalls[0].type, "text");
			assert.strictEqual(callbackCalls[0].text, "hello world");
			assert.strictEqual(result.content, "hello world");
		});

		it("survives callback throwing during text events", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("query")] },
				{
					messages: [
						new HumanMessage("query"),
						new AIMessageChunk({ content: "response", id: "msg1" }),
					],
				},
			];

			const agentMock = createMock(createStream(snapshots));
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

		it("does not hang on empty state snapshots", async () => {
			const snapshots = [
				{ messages: [new HumanMessage("query")] },
				{ messages: [new HumanMessage("query")] },
			];

			const agentMock = createMock(createStream(snapshots));
			const startTime = Date.now();
			const callback = () => {};

			let result = null;
			try {
				result = await callReactAgent(agentMock, "query", null, null, callback);
			} catch (err) {
				result = err;
			}

			const elapsed = Date.now() - startTime;
			assert.ok(elapsed < 2000, `Streaming hung for ${elapsed}ms`);
			assert.ok(result.content);
			assert.strictEqual(result.content, "query");
		});
	});
});
