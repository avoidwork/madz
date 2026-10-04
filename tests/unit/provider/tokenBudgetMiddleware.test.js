import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
	createTokenBudgetMiddleware,
	readUsageTokens,
} from "../../../src/provider/tokenBudgetMiddleware.js";
import { createTokenBudget } from "../../../src/provider/tokenBudget.js";

/** No-op sleep so 429 retry tests do not wait real seconds. */
const noSleep = async () => {};

/**
 * Build a mock model exposing `getNumTokensFromMessages`, mirroring the
 * ChatOpenAI tokenizer API used by the middleware's `estimateCost`.
 * @param {number} [totalCount] - Token count returned by the mock
 * @returns {Object} A mock model
 */
function makeMockModel(totalCount = 10) {
	return {
		getNumTokensFromMessages: async () => ({ totalCount, countPerMessage: [totalCount] }),
	};
}

/**
 * Build a middleware wired to a fresh, isolated budget.
 * @param {Object} [overrides] - Option overrides
 * @returns {{mw: Object, budget: Object}} Middleware and its budget
 */
function makeMiddleware(overrides = {}) {
	const maxTokensMinute = overrides.maxTokensMinute ?? 100000;
	const budget = createTokenBudget(maxTokensMinute);
	const mw = createTokenBudgetMiddleware({
		maxTokensMinute,
		model: makeMockModel(),
		maxTokens: 0,
		budget,
		sleep: noSleep,
		...overrides,
	});
	return { mw, budget };
}

/**
 * Minimal wrapModelCall request shape.
 * @param {string} text - User message text
 * @returns {Object} request
 */
function makeRequest(text = "hello") {
	return {
		messages: [{ role: "user", content: text, _getType: () => "user" }],
		systemMessage: null,
		model: {},
	};
}

describe("createTokenBudgetMiddleware factory", () => {
	it("returns null when maxTokensMinute is 0", () => {
		assert.strictEqual(createTokenBudgetMiddleware({ maxTokensMinute: 0, model: "gpt-4o" }), null);
	});

	it("returns null when maxTokensMinute is absent", () => {
		assert.strictEqual(createTokenBudgetMiddleware({ model: "gpt-4o" }), null);
	});

	it("names the middleware TokenBudget and exposes wrapModelCall", () => {
		const { mw } = makeMiddleware();
		assert.strictEqual(mw.name, "TokenBudget");
		assert.strictEqual(typeof mw.wrapModelCall, "function");
	});
});

describe("readUsageTokens", () => {
	it("returns 0 for null/undefined result", () => {
		assert.strictEqual(readUsageTokens(null), 0);
		assert.strictEqual(readUsageTokens(undefined), 0);
	});

	it("returns 0 when no usage field is present", () => {
		assert.strictEqual(readUsageTokens({ content: "hi" }), 0);
	});

	it("reads usage_metadata.total_tokens", () => {
		const result = { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		assert.strictEqual(readUsageTokens(result), 15);
	});

	it("sums usage_metadata when total is absent", () => {
		assert.strictEqual(
			readUsageTokens({ usage_metadata: { input_tokens: 10, output_tokens: 5 } }),
			15,
		);
	});

	it("reads legacy usage.prompt_tokens + completion_tokens", () => {
		const result = { usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } };
		assert.strictEqual(readUsageTokens(result), 28);
	});

	it("reads llmOutput.usage", () => {
		assert.strictEqual(
			readUsageTokens({ llmOutput: { usage: { prompt_tokens: 3, completion_tokens: 2 } } }),
			5,
		);
	});
});

describe("TokenBudget.estimateCost via the model tokenizer", () => {
	it("uses model.getNumTokensFromMessages for the input estimate", async () => {
		let receivedMessages;
		const model = {
			getNumTokensFromMessages: async (messages) => {
				receivedMessages = messages;
				return { totalCount: 42, countPerMessage: [42] };
			},
		};
		const budget = createTokenBudget(100000);
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model,
			maxTokens: 0,
			budget,
			sleep: noSleep,
		});
		await mw.wrapModelCall(makeRequest("hello"), async () => ({ content: "no usage" }));
		assert.strictEqual(receivedMessages[0].content, "hello");
		assert.ok(budget.current() >= 42, "estimate should reflect the model tokenizer count");
	});

	it("adds maxTokens to the model tokenizer estimate", async () => {
		const { mw, budget } = makeMiddleware({ maxTokens: 4096 });
		await mw.wrapModelCall(makeRequest(), async () => ({ content: "no usage" }));
		assert.ok(budget.current() >= 4096, "estimate should include the output budget");
	});

	it("normalizes maxTokens -1 to 0 (no output budget)", async () => {
		const { mw, budget } = makeMiddleware({ maxTokens: -1 });
		await mw.wrapModelCall(makeRequest(), async () => ({ content: "no usage" }));
		// The mock model returns totalCount 10; -1 must not add a negative budget.
		assert.ok(budget.current() >= 10, "-1 must be treated as 0 (no output budget)");
	});

	it("handles an empty messages array", async () => {
		const model = {
			getNumTokensFromMessages: async () => ({ totalCount: 0, countPerMessage: [] }),
		};
		const budget = createTokenBudget(100000);
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model,
			maxTokens: 0,
			budget,
			sleep: noSleep,
		});
		await mw.wrapModelCall({ messages: [], systemMessage: null, model: {} }, async () => ({
			content: "no usage",
		}));
		assert.strictEqual(budget.current(), 0, "empty messages should estimate zero");
	});

	it("adds tool definition tokens when tools are provided", async () => {
		const { mw, budget } = makeMiddleware();
		await mw.wrapModelCall(
			{
				...makeRequest(),
				tools: [
					{
						name: "test",
						description: "A test tool",
						schema: { type: "object", properties: { x: { type: "string" } } },
					},
				],
			},
			async () => ({ content: "no usage" }),
		);
		assert.ok(budget.current() > 10, "tool definitions should add tokens to the estimate");
	});
});

describe("TokenBudget.wrapModelCall accounting", () => {
	it("reconciles the reservation to actual usage on success", async () => {
		const { mw, budget } = makeMiddleware();
		const handler = async () => ({
			usage_metadata: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
		});
		await mw.wrapModelCall(makeRequest(), handler);
		assert.strictEqual(budget.current(), 150, "window should hold the reconciled actual total");
	});

	it("keeps the estimate when the response carries no usage", async () => {
		const { mw, budget } = makeMiddleware();
		await mw.wrapModelCall(makeRequest(), async () => ({ content: "no usage" }));
		// Estimate (input tokens + maxTokens=0) must remain; not zero, not doubled.
		assert.ok(budget.current() > 0, "estimate should remain in the window");
	});

	it("includes maxTokens in the estimate", async () => {
		// The middleware must add the configured output budget to the model
		// tokenizer estimate.
		const { mw, budget } = makeMiddleware({ maxTokens: 4096 });
		await mw.wrapModelCall(makeRequest(), async () => ({ content: "no usage" }));
		assert.ok(budget.current() >= 4096, "estimate should include the output budget");
	});

	it("releases the reservation when the handler throws a non-429", async () => {
		const { mw, budget } = makeMiddleware();
		const err = new Error("boom");
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					throw err;
				}),
			/boom/,
		);
		assert.strictEqual(budget.current(), 0, "failed dispatch must not charge the window");
	});

	it("does not retry a non-429 error", async () => {
		const { mw } = makeMiddleware();
		let calls = 0;
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					calls += 1;
					throw new Error("server error");
				}),
			/server error/,
		);
		assert.strictEqual(calls, 1, "non-429 must not be retried");
	});

	it("retries a 429 once, re-paces, and charges only the successful attempt", async () => {
		const { mw, budget } = makeMiddleware();
		let calls = 0;
		const result = await mw.wrapModelCall(makeRequest(), async () => {
			calls += 1;
			if (calls === 1) {
				const e = new Error("rate limited");
				e.status = 429;
				e.headers = { "retry-after": "0" };
				throw e;
			}
			return { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		});
		assert.strictEqual(calls, 2, "should retry the 429 once");
		assert.strictEqual(result.usage_metadata.total_tokens, 15);
		assert.strictEqual(budget.current(), 15, "only the successful attempt is charged");
	});

	it("throws after exhausting the 429 retry", async () => {
		const { mw, budget } = makeMiddleware();
		let calls = 0;
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					calls += 1;
					const e = new Error("still limited");
					e.status = 429;
					throw e;
				}),
			/still limited/,
		);
		assert.strictEqual(calls, 2, "one attempt plus one retry");
		assert.strictEqual(budget.current(), 0, "both failed attempts released their reservations");
	});

	it("attributes a 429 to an exceeded budget when the window is over capacity", async () => {
		// A stub budget pinned above capacity exercises the "exceeded token budget"
		// logging branch, which a real budget resists because reserve() paces the
		// window below capacity. Only the branch selection is under test here.
		const overCapacity = {
			reserve: async () => 1,
			reconcile: () => {},
			release: () => {},
			waitForCapacity: async () => {},
			current: () => 9_999_999,
		};
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model: makeMockModel(),
			maxTokens: 0,
			budget: overCapacity,
			sleep: noSleep,
		});
		let calls = 0;
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					calls += 1;
					const e = new Error("limited");
					e.status = 429;
					throw e;
				}),
			/limited/,
		);
		assert.strictEqual(calls, 2, "retried once even while over capacity");
	});
});

describe("TokenBudget.wrapModelCall 400 context-window compaction", () => {
	it("invokes onContextWindowExceeded and re-sends once on a 400 context-window error", async () => {
		let compactCalls = 0;
		let handlerCalls = 0;
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model: makeMockModel(),
			maxTokens: 0,
			budget: createTokenBudget(100000),
			sleep: noSleep,
			onContextWindowExceeded: async () => {
				compactCalls += 1;
			},
		});
		const result = await mw.wrapModelCall(makeRequest(), async () => {
			handlerCalls += 1;
			if (handlerCalls === 1) {
				const e = new Error("This model's maximum context length is 128000 tokens");
				e.status = 400;
				throw e;
			}
			return { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		});
		assert.strictEqual(compactCalls, 1, "should compact exactly once");
		assert.strictEqual(handlerCalls, 2, "should re-send the request once");
		assert.strictEqual(result.usage_metadata.total_tokens, 15);
	});

	it("passes the error and request to onContextWindowExceeded", async () => {
		let captured;
		let handlerCalls = 0;
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model: makeMockModel(),
			maxTokens: 0,
			budget: createTokenBudget(100000),
			sleep: noSleep,
			onContextWindowExceeded: async (err, request) => {
				captured = { err, request };
			},
		});
		const request = makeRequest();
		await mw.wrapModelCall(request, async () => {
			handlerCalls += 1;
			if (handlerCalls === 1) {
				const e = new Error("maximum context length exceeded (limit: 8192)");
				e.status = 400;
				throw e;
			}
			return { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		});
		assert.strictEqual(captured.err.status, 400);
		assert.strictEqual(captured.request, request);
	});

	it("does not compact a non-context 400 error", async () => {
		let compactCalls = 0;
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model: makeMockModel(),
			maxTokens: 0,
			budget: createTokenBudget(100000),
			sleep: noSleep,
			onContextWindowExceeded: async () => {
				compactCalls += 1;
			},
		});
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					const e = new Error("Invalid API key");
					e.status = 400;
					throw e;
				}),
			/Invalid API key/,
		);
		assert.strictEqual(compactCalls, 0, "non-context 400 must not trigger compaction");
	});

	it("surfaces the error when the retry also fails with a context-window error", async () => {
		let compactCalls = 0;
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model: makeMockModel(),
			maxTokens: 0,
			budget: createTokenBudget(100000),
			sleep: noSleep,
			onContextWindowExceeded: async () => {
				compactCalls += 1;
			},
		});
		await assert.rejects(
			() =>
				mw.wrapModelCall(makeRequest(), async () => {
					const e = new Error("This model's maximum context length is 128000 tokens");
					e.status = 400;
					throw e;
				}),
			/context length/,
		);
		assert.strictEqual(compactCalls, 1, "should compact once before surfacing");
	});
});

describe("TokenBudget middleware enforces on the real agent dispatch path", () => {
	// This is the regression test for the original defect. It drives a REAL
	// createAgent with a REAL ChatOpenAI, so the dispatch goes through
	// AgentNode -> bindTools() -> withConfig(), which builds a NEW model object.
	// Enforcement wired onto the model instance (the original approach) is
	// orphaned by that rebuild and would leave budget.current() at 0 — this test
	// fails red if enforcement is moved back onto the instance.
	let originalFetch;
	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	const restore = () => {
		globalThis.fetch = originalFetch;
	};

	const stubFetch = (factory) => {
		globalThis.fetch = async () => factory();
	};

	const completion = (usage) =>
		new Response(
			JSON.stringify({
				id: "x",
				object: "chat.completion",
				created: 0,
				model: "gpt-4o",
				choices: [
					{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" },
				],
				usage,
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);

	it("charges the shared window for a dispatch that traverses bindTools", async () => {
		const { mw, budget } = makeMiddleware();
		stubFetch(() => completion({ prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 }));
		try {
			const model = new ChatOpenAI({
				model: "gpt-4o",
				apiKey: "sk-test",
				configuration: { baseURL: "http://127.0.0.1:9/v1" },
				maxRetries: 0,
			});
			const t = tool(() => "ok", {
				name: "noop",
				description: "d",
				schema: z.object({ a: z.string().optional() }),
			});
			const agent = createAgent({ model, tools: [t], middleware: [mw] });
			await agent.invoke({ messages: [{ role: "user", content: "hello world this is a test" }] });
			assert.strictEqual(
				budget.current(),
				15,
				"the agent dispatch must be charged to the shared window",
			);
		} finally {
			restore();
		}
	});

	it("a second agent sharing the same budget accumulates into one window", async () => {
		const { mw, budget } = makeMiddleware();
		stubFetch(() => completion({ prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 }));
		try {
			const mkAgent = () => {
				const model = new ChatOpenAI({
					model: "gpt-4o",
					apiKey: "sk-test",
					configuration: { baseURL: "http://127.0.0.1:9/v1" },
					maxRetries: 0,
				});
				const t = tool(() => "ok", {
					name: "noop",
					description: "d",
					schema: z.object({ a: z.string().optional() }),
				});
				return createAgent({ model, tools: [t], middleware: [mw] });
			};
			await mkAgent().invoke({ messages: [{ role: "user", content: "one" }] });
			await mkAgent().invoke({ messages: [{ role: "user", content: "two" }] });
			assert.strictEqual(budget.current(), 30, "both dispatches share one window");
		} finally {
			restore();
		}
	});
});
