/**
 * Mid-run overflow compaction test.
 *
 * Wires a real agent (MemorySaver checkpointer + deepagents summarization
 * middleware + the token-budget middleware) and triggers a 400 context-window
 * error inside the running graph step. Asserts that the re-sent request is the
 * compacted window and that the compaction is persisted in the checkpointer.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createAgent } from "langchain";
import { createSummarizationMiddleware } from "deepagents";
import { MemorySaver } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createTokenBudgetMiddleware } from "../../../src/provider/tokenBudgetMiddleware.js";
import { createTokenBudget } from "../../../src/provider/tokenBudget.js";
import { compactRequest } from "../../../src/agent/compaction.js";
import { getEffectiveMessages } from "../../../src/agent/effectiveMessages.js";

/** Chat model that fails with a 400 context error on its first call only. */
class OverflowOnceModel extends BaseChatModel {
	constructor() {
		super({});
		this.calls = [];
	}

	_llmType() {
		return "overflow-once";
	}

	bindTools() {
		return this;
	}

	async _generate(messages) {
		this.calls.push(messages);
		if (this.calls.length === 1) {
			const err = new Error("400 This model's maximum context length is exceeded");
			err.status = 400;
			throw err;
		}
		return { generations: [{ text: "done", message: new AIMessage("done") }] };
	}
}

/** Summarizer stand-in for `compactMessages` (only `invoke` is used). */
const summarizer = { invoke: async () => new AIMessage("SUMMARY-TEXT") };

/** Number of messages preserved verbatim; the assertions below depend on it. */
const KEEP = 2;

/** Number of messages sent in the first turn. */
const INPUT_COUNT = 6;

/**
 * Build an agent whose first model call overflows and is compacted in memory.
 * @returns {{agent: Object, model: Object, config: Object}} Agent, model, run config
 */
function makeAgent() {
	const model = new OverflowOnceModel();
	const budgetMw = createTokenBudgetMiddleware({
		maxTokensMinute: 1_000_000,
		model: { getNumTokensFromMessages: async () => ({ totalCount: 1 }) },
		maxTokens: 0,
		budget: createTokenBudget(1_000_000),
		onContextWindowExceeded: (_err, request) =>
			compactRequest(request, { model: summarizer, keep: KEEP }),
	});
	const agent = createAgent({
		model,
		tools: [],
		checkpointer: new MemorySaver(),
		middleware: [createSummarizationMiddleware({ model, backend: undefined }), budgetMw],
	});
	return { agent, model, config: { configurable: { thread_id: "mid-run" } } };
}

/**
 * Send `count` human messages.
 * @param {number} count - Number of messages
 * @returns {Object} Agent input
 */
function makeInput(count) {
	return { messages: Array.from({ length: count }, (_, i) => new HumanMessage(`message-${i}`)) };
}

describe("overflow compaction while the graph step is running", () => {
	it("re-sends the compacted window after a context-window error", async () => {
		const { agent, model, config } = makeAgent();
		await agent.invoke(makeInput(INPUT_COUNT), config);

		assert.strictEqual(model.calls.length, 2, "should re-send exactly once");
		const resent = model.calls[1].map((m) => String(m.content));
		assert.strictEqual(resent.length, KEEP + 1, "summary plus the preserved tail");
		assert.ok(resent[0].includes("SUMMARY-TEXT"));
		assert.deepStrictEqual(resent.slice(1), [
			`message-${INPUT_COUNT - KEEP}`,
			`message-${INPUT_COUNT - 1}`,
		]);
	});

	it("persists the compaction in the checkpointer", async () => {
		const { agent, config } = makeAgent();
		await agent.invoke(makeInput(INPUT_COUNT), config);

		const { values } = await agent.getState(config);
		assert.ok(values._summarizationEvent, "the summarization event is checkpointed");
		assert.strictEqual(values._summarizationEvent.cutoffIndex, INPUT_COUNT - KEEP);

		const effective = getEffectiveMessages(values).map((m) => String(m.content));
		assert.ok(effective[0].includes("SUMMARY-TEXT"));
		assert.strictEqual(effective.at(-1), "done");
		assert.ok(!effective.includes("message-0"), "summarized messages left the window");
		assert.strictEqual(values.messages.length, INPUT_COUNT + 1, "raw history is untouched");
	});
});
