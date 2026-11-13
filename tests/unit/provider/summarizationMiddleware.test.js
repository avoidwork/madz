import { describe, it } from "node:test";
import assert from "node:assert";
import { HumanMessage } from "@langchain/core/messages";
import {
	createSummarizationMiddlewareFromConfig,
	resolveKeepMessages,
} from "../../../src/provider/summarizationMiddleware.js";

const msgs = (n) => Array.from({ length: n }, (_, i) => new HumanMessage(`m${i}`));
const model = { invoke: async () => ({ text: "SUM" }) };
const enabled = (extra = {}) => ({
	enabled: true,
	trigger: { type: "tokens", value: 1000 },
	keepMessages: 5,
	...extra,
});
const run = (mw, state) => mw.beforeModel.hook(state, { configurable: { thread_id: "t" } });

describe("resolveKeepMessages", () => {
	it("prefers keepMessages", () => {
		assert.strictEqual(
			resolveKeepMessages({ keepMessages: 3, keep: { type: "messages", value: 9 } }),
			3,
		);
	});
	it("honors a legacy messages keep", () => {
		assert.strictEqual(resolveKeepMessages({ keep: { type: "messages", value: 9 } }), 9);
	});
	it("defaults to 5", () => {
		assert.strictEqual(resolveKeepMessages({}), 5);
		assert.strictEqual(resolveKeepMessages({ keep: { type: "tokens", value: 9 } }), 5);
	});
});

describe("createSummarizationMiddlewareFromConfig", () => {
	it("returns null when config is absent or disabled", () => {
		assert.strictEqual(createSummarizationMiddlewareFromConfig({}), null);
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ config: { enabled: false } }),
			null,
		);
	});

	it("returns null when enabled without a trigger", () => {
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ config: { enabled: true } }),
			null,
		);
	});

	it("is named SummarizationMiddleware and uses beforeModel", () => {
		const mw = createSummarizationMiddlewareFromConfig({ model, config: enabled() });
		assert.strictEqual(mw.name, "SummarizationMiddleware");
		assert.strictEqual(typeof mw.beforeModel.hook, "function");
		assert.strictEqual(mw.wrapModelCall, undefined);
	});

	it("does nothing below the token trigger", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled(),
			tokenCounter: async () => 999,
		});
		assert.strictEqual(await run(mw, { messages: msgs(20) }), undefined);
	});

	it("rewrites state to [RemoveAll, summary, ...5] at the trigger", async () => {
		const seen = [];
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled(),
			tokenCounter: async () => 1000,
			onCompacted: (r) => seen.push(r),
		});
		const out = await run(mw, { messages: msgs(20) });
		assert.strictEqual(out.messages.length, 7);
		assert.strictEqual(out.messages[0].id, "__remove_all__");
		assert.match(out.messages[1].content, /SUM/);
		assert.strictEqual(out.messages[2].content, "m15");
		assert.strictEqual(out.messages.at(-1).content, "m19");
		assert.strictEqual(seen.length, 1);
		assert.strictEqual(seen[0].kept, 5);
	});

	it("counts the system prompt toward the trigger", async () => {
		let counted;
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			systemPrompt: "SYS",
			config: enabled(),
			tokenCounter: async (m) => {
				counted = m;
				return 0;
			},
		});
		await run(mw, { messages: msgs(2) });
		assert.strictEqual(counted.length, 3);
		assert.strictEqual(counted[0].content, "SYS");
	});

	it("falls back to an estimate when the token counter throws", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled({ trigger: { type: "tokens", value: 10 } }),
			tokenCounter: async () => {
				throw new Error("boom");
			},
		});
		const out = await run(mw, { messages: [new HumanMessage("x".repeat(4000)), ...msgs(8)] });
		assert.ok(out.messages.length > 0);
	});

	it("supports a messages trigger", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled({ trigger: { type: "messages", value: 10 } }),
		});
		assert.strictEqual(await run(mw, { messages: msgs(9) }), undefined);
		assert.ok(await run(mw, { messages: msgs(10) }));
	});

	it("returns null (with a warning) for an unsupported trigger type", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled({ trigger: { type: "fraction", value: 0.5 } }),
		});
		assert.strictEqual(mw, null);
	});

	it("leaves state unchanged when summarization fails, and backs off", async () => {
		let calls = 0;
		const bad = {
			invoke: async () => {
				calls++;
				throw new Error("down");
			},
		};
		const mw = createSummarizationMiddlewareFromConfig({
			model: bad,
			config: enabled({ trigger: { type: "messages", value: 5 } }),
		});
		assert.strictEqual(await run(mw, { messages: msgs(10) }), undefined);
		assert.strictEqual(calls, 1);
		// Too few new messages: do not retry yet.
		assert.strictEqual(await run(mw, { messages: msgs(11) }), undefined);
		assert.strictEqual(calls, 1);
		// Enough new messages: retry.
		await run(mw, { messages: msgs(14) });
		assert.strictEqual(calls, 2);
	});

	it("does nothing for empty state and survives a throwing onCompacted", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled({ trigger: { type: "messages", value: 5 } }),
			onCompacted: () => {
				throw new Error("cb");
			},
		});
		assert.strictEqual(await run(mw, { messages: [] }), undefined);
		assert.ok(await run(mw, { messages: msgs(10) }));
	});

	it("does nothing when there is nothing to compact", async () => {
		const mw = createSummarizationMiddlewareFromConfig({
			model,
			config: enabled({ trigger: { type: "messages", value: 3 } }),
		});
		assert.strictEqual(await run(mw, { messages: msgs(4) }), undefined);
	});
});
