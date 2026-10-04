import { describe, it } from "node:test";
import assert from "node:assert";
import { createTokenBudgetMiddleware } from "../../src/provider/tokenBudgetMiddleware.js";
import { createTokenBudget } from "../../src/provider/tokenBudget.js";

/**
 * Integration test verifying the context-counting path uses the model's own
 * tokenizer (`model.getNumTokensFromMessages`) on the real checkpointer message
 * array (LangChain messages with tool calls, tool messages, and content blocks)
 * after a multi-turn conversation, rather than the lossy
 * `sessionState.getConversation()` `{role, content}` array.
 *
 * The checkpointer is the source of truth: `agent.getState(config)` →
 * `state.values.messages` returns the full LangChain message array the model
 * sees. The token-budget middleware's `estimateCost` must pass that array to
 * `model.getNumTokensFromMessages(messages)` so the estimate is not
 * under-counted.
 */
describe("integration - context counting uses the model tokenizer on checkpointer state", () => {
	it("passes the full checkpointer message array to model.getNumTokensFromMessages", async () => {
		// Simulate the real LangChain message array returned by
		// `agent.getState(config)` → `state.values.messages` after a multi-turn
		// conversation that included a tool call.
		const checkpointerMessages = [
			{ _getType: () => "system", content: "You are a helpful assistant." },
			{ _getType: () => "human", content: "What is the weather in Paris?" },
			{
				_getType: () => "ai",
				content: "Let me check the weather.",
				tool_calls: [{ name: "getWeather", args: { city: "Paris" }, id: "call_1" }],
			},
			{ _getType: () => "tool", content: "Sunny, 72°F", name: "getWeather" },
			{ _getType: () => "ai", content: "It is sunny in Paris at 72°F." },
			{ _getType: () => "human", content: "And in London?" },
			{
				_getType: () => "ai",
				content: "Let me check London too.",
				tool_calls: [{ name: "getWeather", args: { city: "London" }, id: "call_2" }],
			},
			{ _getType: () => "tool", content: "Cloudy, 60°F", name: "getWeather" },
			{ _getType: () => "ai", content: "It is cloudy in London at 60°F." },
		];

		// A mock model that records the exact message array handed to the
		// tokenizer, mirroring the ChatOpenAI `getNumTokensFromMessages` API.
		let receivedMessages;
		const model = {
			getNumTokensFromMessages: async (messages) => {
				receivedMessages = messages;
				return { totalCount: 100, countPerMessage: messages.map(() => 10) };
			},
		};

		const budget = createTokenBudget(100000);
		const mw = createTokenBudgetMiddleware({
			maxTokensMinute: 100000,
			model,
			maxTokens: 0,
			budget,
			sleep: async () => {},
		});

		await mw.wrapModelCall(
			{ messages: checkpointerMessages, systemMessage: null, model: {} },
			async () => ({ content: "no usage" }),
		);

		assert.strictEqual(receivedMessages, checkpointerMessages);
		assert.strictEqual(receivedMessages.length, 9);
		assert.ok(budget.current() >= 100, "estimate should reflect the model tokenizer count");
	});

	it("counts a multi-turn conversation with tool calls from the checkpointer", async () => {
		const checkpointerMessages = [
			{ _getType: () => "human", content: "What is the weather in Paris?" },
			{
				_getType: () => "ai",
				content: "Let me check the weather.",
				tool_calls: [{ name: "getWeather", args: { city: "Paris" }, id: "call_1" }],
			},
			{ _getType: () => "tool", content: "Sunny, 72°F", name: "getWeather" },
			{ _getType: () => "ai", content: "It is sunny in Paris at 72°F." },
		];

		// The lossy sessionState array omits tool calls and tool messages.
		const lossyConversation = [
			{ role: "user", content: "What is the weather in Paris?" },
			{ role: "assistant", content: "It is sunny in Paris at 72°F." },
		];

		let checkpointerCount = 0;
		let lossyCount = 0;
		const model = {
			getNumTokensFromMessages: async (messages) => {
				// A simple length-based proxy: the full checkpointer array has more
				// messages than the lossy array, so it must count higher.
				return { totalCount: messages.length * 10, countPerMessage: messages.map(() => 10) };
			},
		};

		const run = async (messages) => {
			const budget = createTokenBudget(100000);
			const mw = createTokenBudgetMiddleware({
				maxTokensMinute: 100000,
				model,
				maxTokens: 0,
				budget,
				sleep: async () => {},
			});
			await mw.wrapModelCall({ messages, systemMessage: null, model: {} }, async () => ({
				content: "no usage",
			}));
			return budget.current();
		};

		checkpointerCount = await run(checkpointerMessages);
		lossyCount = await run(lossyConversation);

		assert.ok(
			checkpointerCount > lossyCount,
			"the checkpointer-derived count must exceed the lossy count because it includes tool calls and tool messages",
		);
	});
});
