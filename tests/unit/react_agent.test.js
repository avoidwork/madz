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

		await callReactAgent(agentMock, "what is 2+2");
		assert.ok(capturedMessages.length >= 1);
		assert.ok(capturedMessages[0] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[0].content, "what is 2+2");
	});

	it("invokes agent with system message when provided", async () => {
		let capturedMessages = null;

		const agentMock = {
			invoke: (input) => {
				capturedMessages = input.messages;
				return {
					messages: [new AIMessage("response")],
				};
			},
		};

		await callReactAgent(agentMock, "hello world", "You are a helpful assistant.");
		assert.strictEqual(capturedMessages.length, 2);
		assert.ok(capturedMessages[0] instanceof SystemMessage);
		assert.strictEqual(capturedMessages[0].content, "You are a helpful assistant.");
		assert.ok(capturedMessages[1] instanceof HumanMessage);
		assert.strictEqual(capturedMessages[1].content, "hello world");
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

		const result = await callReactAgent(agentMock, "what is 2+2", "system prompt");
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

		const result = await callReactAgent(agentMock, "query", "system");
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
			await callReactAgent(agentMock, "test");
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

		const result = await callReactAgent(agentMock, "query");
		assert.strictEqual(result.content, "final answer");
	});

	it("falls back to input message when no AI content found", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new HumanMessage("user input")],
			}),
		};

		const result = await callReactAgent(agentMock, "user input");
		assert.strictEqual(result.content, "user input");
	});

	it("falls back to input message when all messages lack content", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [],
			}),
		};

		const result = await callReactAgent(agentMock, "fallback text");
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
		const toolEvents = [
			{
				method: "tools",
				params: { data: { event: "tool_called", name: "search", toolCallId: "1" } },
			},
		];
		let toolIdx = 0;

		// Simulates ChatModelStream.text as async iterable yielding delta chunks
		const chatMessage1 = {
			text: {
				[Symbol.asyncIterator]() {
					const deltas = ["Hello", ",  ", "world!"];
					let i = 0;
					return {
						next() {
							if (i < deltas.length) {
								return Promise.resolve({ value: deltas[i++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			},
		};

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						let sent = 0;
						return {
							next() {
								if (sent < 1) {
									sent++;
									return Promise.resolve({ value: chatMessage1, done: false });
								}
								return Promise.resolve({ done: true });
							},
						};
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
			invoke: () => ({ messages: [new AIMessage("should not be called")] }),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "hello", null, callback);
		// 3 text callbacks: "Hello", "Hello,", "Hello, world!"
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
		// Simulates ChatModelStream.text yielding empty, whitespace, then content
		const chatMessage = {
			text: {
				[Symbol.asyncIterator]() {
					const deltas = ["", "   ", "hello"];
					let i = 0;
					return {
						next() {
							if (i < deltas.length) {
								return Promise.resolve({ value: deltas[i++], done: false });
							}
							return Promise.resolve({ done: true });
						},
					};
				},
			},
		};

		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						let sent = 0;
						return {
							next() {
								if (sent < 1) {
									sent++;
									return Promise.resolve({ value: chatMessage, done: false });
								}
								return Promise.resolve({ done: true });
							},
						};
					},
				},
				[Symbol.asyncIterator]() {
					return {
						next() {
							return Promise.resolve({ done: true });
						},
					};
				},
			}),
		};

		const callbackCalls = [];
		const callback = (event) => callbackCalls.push(event);

		const result = await callReactAgent(agentMock, "fallback", null, callback);
		// "" → accumulated "" → trim "" → falsy → no callback
		// "   " → accumulated "   " → trim "" → falsy → no callback
		// "hello" → accumulated "   hello" → trim "hello" → callback once
		assert.strictEqual(callbackCalls.length, 1);
		assert.strictEqual(callbackCalls[0].type, "text");
		assert.strictEqual(callbackCalls[0].text, "hello");
		assert.strictEqual(result.content, "hello");
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

		await callReactAgent(agentMock, "test", null, callback);
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

		const result = await callReactAgent(agentMock, "original message", null, callback);
		assert.strictEqual(callbackCalls.length, 0);
		assert.strictEqual(result.content, "original message");
	});

	it("callback not called when no streaming callback provided", async () => {
		const agentMock = {
			invoke: () => ({
				messages: [new AIMessage("full response")],
			}),
		};

		const result = await callReactAgent(agentMock, "ask", "system");
		assert.strictEqual(result.content, "full response");
	});

	it("handles async iterable text on ChatModelStream", async () => {
		const agentMock = {
			streamEvents: () => ({
				messages: {
					[Symbol.asyncIterator]() {
						let sent = 0;
						return {
							next() {
								if (sent < 1) {
									sent++;
									return Promise.resolve({
										value: {
											text: {
												[Symbol.asyncIterator]() {
													let i = 0;
													return {
														next() {
															if (i < 1) {
																i++;
																return Promise.resolve({ value: "sync text", done: false });
															}
															return Promise.resolve({ done: true });
														},
													};
												},
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

		const result = await callReactAgent(agentMock, "hi", null, callback);
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

		await callReactAgent(agentMock, "test", null, callback);
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

		const result = await callReactAgent(agentMock, "fallback", null, callback);
		assert.strictEqual(callbackCalls.length, 0);
		assert.strictEqual(result.content, "fallback");
	});
});
