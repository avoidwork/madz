import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { StateBackend } from "deepagents";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createSummarizationMiddlewareFromConfig } from "../../src/provider/summarizationMiddleware.js";

/**
 * Runtime probe for the blocking acceptance criterion: the custom
 * `SummarizationMiddleware` must be PROVEN to fire at the configured value,
 * not the 170k library default, and the library default must be genuinely
 * absent from the effective stack.
 *
 * We drive a REAL `createAgent` with a REAL `ChatOpenAI` and a mocked fetch.
 * The summarization middleware calls `chatModel.invoke(...)` to generate the
 * summary, so a second fetch (beyond the agent dispatch) is the observable
 * signal that compaction fired. With a `messages` trigger of 2 and 3 input
 * messages, the 170k token default would NEVER fire — only the custom
 * middleware at the configured value does.
 */
describe("integration - configurable summarization middleware fires at runtime", () => {
	let originalFetch;
	let fetchCalls;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchCalls = 0;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const completion = (content = "hi") =>
		new Response(
			JSON.stringify({
				id: "x",
				object: "chat.completion",
				created: 0,
				model: "gpt-4o",
				choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);

	const stubFetch = () => {
		globalThis.fetch = async () => {
			fetchCalls += 1;
			return completion();
		};
	};

	const makeModel = () =>
		new ChatOpenAI({
			model: "gpt-4o",
			apiKey: "sk-test",
			configuration: { baseURL: "http://127.0.0.1:9/v1" },
			maxRetries: 0,
		});

	const makeTool = () =>
		tool(() => "ok", {
			name: "noop",
			description: "d",
			schema: z.object({ a: z.string().optional() }),
		});

	it("fires compaction at the configured messages trigger, not the 170k default", async () => {
		stubFetch();
		const mw = createSummarizationMiddlewareFromConfig({
			backend: new StateBackend(),
			config: {
				enabled: true,
				trigger: { type: "messages", value: 2 },
				keep: { type: "messages", value: 1 },
			},
		});
		assert.ok(mw, "custom middleware should be built");
		assert.strictEqual(mw.name, "SummarizationMiddleware");

		const agent = createAgent({ model: makeModel(), tools: [makeTool()], middleware: [mw] });
		await agent.invoke({
			messages: [
				{ role: "user", content: "message one" },
				{ role: "assistant", content: "reply one" },
				{ role: "user", content: "message two" },
			],
		});

		// fetch #1 = agent dispatch; fetch #2 = summary generation. The 170k
		// token default would never summarize a 3-message conversation, so a
		// second fetch proves the custom middleware (not the library default)
		// fired at the configured value.
		assert.ok(fetchCalls >= 2, `expected compaction to fire (>=2 fetches), got ${fetchCalls}`);
	});

	it("does not compact when the trigger is not crossed (library default absent)", async () => {
		stubFetch();
		const mw = createSummarizationMiddlewareFromConfig({
			backend: new StateBackend(),
			config: {
				enabled: true,
				trigger: { type: "messages", value: 10 },
				keep: { type: "messages", value: 1 },
			},
		});
		assert.ok(mw, "custom middleware should be built");

		const agent = createAgent({ model: makeModel(), tools: [makeTool()], middleware: [mw] });
		await agent.invoke({
			messages: [
				{ role: "user", content: "message one" },
				{ role: "assistant", content: "reply one" },
			],
		});

		// Only the agent dispatch fetch should occur — no summary generation.
		assert.strictEqual(fetchCalls, 1, "no compaction should fire below the trigger");
	});

	it("unset config reproduces today's behavior (no custom middleware, no compaction)", async () => {
		stubFetch();
		// config absent -> factory returns null -> no custom middleware.
		const mw = createSummarizationMiddlewareFromConfig({ backend: new StateBackend() });
		assert.strictEqual(mw, null, "unset config must be a true no-op");

		const agent = createAgent({ model: makeModel(), tools: [makeTool()], middleware: [] });
		await agent.invoke({
			messages: [
				{ role: "user", content: "message one" },
				{ role: "assistant", content: "reply one" },
				{ role: "user", content: "message two" },
			],
		});
		// No custom middleware -> no summary generation fetch.
		assert.strictEqual(fetchCalls, 1, "no compaction without a custom middleware");
	});
});
