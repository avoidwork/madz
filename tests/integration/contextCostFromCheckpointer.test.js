import { describe, it } from "node:test";
import assert from "node:assert";
import { computeContextSize } from "../../src/tui/conversationArea.js";
import { toConversation } from "../../src/provider/tokenBudgetMiddleware.js";

/**
 * Integration test verifying the TUI context counter reflects the real
 * checkpointer state (LangChain messages with tool calls, tool messages, and
 * content blocks) after a multi-turn conversation, rather than the lossy
 * `sessionState.getConversation()` `{role, content}` array.
 *
 * The checkpointer is the source of truth: `agent.getState(config)` →
 * `state.values.messages` returns the full LangChain message array the model
 * sees. `computeContextSize` must normalize that array (via `toConversation`)
 * and count it, so the counter does not under-report tool calls and tool
 * messages.
 */
describe("integration - TUI context counter reflects checkpointer state", () => {
	it("counts a multi-turn conversation with tool calls from the checkpointer", async () => {
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

		// The lossy sessionState array omits tool calls and tool messages.
		const lossyConversation = [
			{ role: "user", content: "What is the weather in Paris?" },
			{ role: "assistant", content: "It is sunny in Paris at 72°F." },
			{ role: "user", content: "And in London?" },
			{ role: "assistant", content: "It is cloudy in London at 60°F." },
		];

		const systemPrompt = "You are a helpful assistant.";
		const modelName = "gpt-4o";

		const fromCheckpointer = await computeContextSize({
			conversation: checkpointerMessages,
			systemPrompt,
			maxTokens: 0,
			modelName,
		});
		const fromLossy = await computeContextSize({
			conversation: lossyConversation,
			systemPrompt,
			maxTokens: 0,
			modelName,
		});

		assert.ok(
			fromCheckpointer > fromLossy,
			"the checkpointer-derived count must exceed the lossy count because it includes tool calls and tool messages",
		);
	});

	it("normalizes the checkpointer message array via toConversation", () => {
		const checkpointerMessages = [
			{ _getType: () => "human", content: "hi" },
			{
				_getType: () => "ai",
				content: "Let me search.",
				tool_calls: [{ name: "search", args: { q: "madz" }, id: "call_1" }],
			},
			{ _getType: () => "tool", content: "42 results", name: "search" },
		];
		const normalized = toConversation(checkpointerMessages);
		assert.deepStrictEqual(
			normalized.map((m) => m.role),
			["user", "assistant", "tool"],
		);
		assert.ok(normalized[1].content.includes("search"), "tool call name preserved");
		assert.strictEqual(normalized[2].content, "42 results", "tool message content preserved");
	});

	it("falls back to the lossy conversation when the accessor is unavailable", async () => {
		// When no checkpointer accessor is present, computeContextSize must still
		// work with the sessionState {role, content} array.
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		];
		const result = await computeContextSize({
			conversation,
			systemPrompt: "You are a helpful assistant.",
			maxTokens: 0,
			modelName: "gpt-4o",
		});
		assert.strictEqual(typeof result, "number");
		assert.ok(result > 0);
	});
});
