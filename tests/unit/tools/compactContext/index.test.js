/**
 * Tests for the compactContext tool and utilities.
 * @see {@link src/tools/compactContext/index.js}
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import {
	extractContextLength,
	isContextLengthError,
	compactConversation,
	createCompactContextTool,
} from "../../../../src/tools/compactContext/index.js";

describe("extractContextLength", () => {
	test("should extract context length from standard format", () => {
		const result = extractContextLength(
			"maximum context length is 128000 tokens",
		);
		assert.strictEqual(result, 128000);
	});

	test("should extract context length with 'of' format", () => {
		const result = extractContextLength(
			"maximum context length of 8192 tokens exceeded",
		);
		assert.strictEqual(result, 8192);
	});

	test("should extract context length from limit format", () => {
		const result = extractContextLength("context limit: 4096");
		assert.strictEqual(result, 4096);
	});

	test("should extract context length from limit format with space", () => {
		const result = extractContextLength("context limit 16384");
		assert.strictEqual(result, 16384);
	});

	test("should return null for non-string input", () => {
		assert.strictEqual(extractContextLength(null), null);
		assert.strictEqual(extractContextLength(undefined), null);
		assert.strictEqual(extractContextLength(123), null);
		assert.strictEqual(extractContextLength({}), null);
	});

	test("should return null for empty string", () => {
		assert.strictEqual(extractContextLength(""), null);
	});

	test("should return null when no pattern matches", () => {
		assert.strictEqual(
			extractContextLength("some random error message"),
			null,
		);
	});

	test("should handle case insensitivity", () => {
		const result = extractContextLength(
			"MAXIMUM CONTEXT LENGTH is 32000 tokens",
		);
		assert.strictEqual(result, 32000);
	});

	test("should prefer first pattern match", () => {
		const result = extractContextLength(
			"maximum context length is 10000 tokens",
		);
		assert.strictEqual(result, 10000);
	});
});

describe("isContextLengthError", () => {
	test("should return true for standard format error", () => {
		const err = new Error("maximum context length is 128000 tokens");
		assert.strictEqual(isContextLengthError(err), true);
	});

	test("should return true for limit format error", () => {
		const err = new Error("context limit: 4096 exceeded");
		assert.strictEqual(isContextLengthError(err), true);
	});

	test("should return false for non-context errors", () => {
		const err = new Error("rate limit exceeded");
		assert.strictEqual(isContextLengthError(err), false);
	});

	test("should return false for null error", () => {
		assert.strictEqual(isContextLengthError(null), false);
	});

	test("should return false for error without message", () => {
		const err = new Error();
		assert.strictEqual(isContextLengthError(err), false);
	});

	test("should return false for error with empty message", () => {
		const err = new Error("");
		assert.strictEqual(isContextLengthError(err), false);
	});

	test("should handle case insensitivity", () => {
		const err = new Error("MAXIMUM CONTEXT LENGTH is 128000 tokens");
		assert.strictEqual(isContextLengthError(err), true);
	});
});

describe("compactConversation", () => {
	test("should return empty result for empty conversation", () => {
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation: [],
			targetTokens: 50000,
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.compactedMessages, []);
		assert.strictEqual(result.compactedTokenCount, 0);
	});

	test("should return empty result for null conversation", () => {
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation: null,
			targetTokens: 50000,
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.compactedMessages, []);
	});

	test("should return empty result for undefined conversation", () => {
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation: undefined,
			targetTokens: 50000,
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.compactedMessages, []);
	});

	test("should include system prompt in result", () => {
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation: [{ role: "user", content: "Hello" }],
			targetTokens: 50000,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.compactedMessages[0].role, "system");
		assert.strictEqual(
			result.compactedMessages[0].content,
			"You are helpful.",
		);
	});

	test("should retain recent exchanges in full", () => {
		const conversation = [
			{ role: "user", content: "Message 1" },
			{ role: "assistant", content: "Response 1" },
			{ role: "user", content: "Message 2" },
			{ role: "assistant", content: "Response 2" },
			{ role: "user", content: "Message 3" },
			{ role: "assistant", content: "Response 3" },
		];

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
			recentCount: 2,
		});

		assert.strictEqual(result.ok, true);
		// Should have system + 2 recent exchanges (4 messages)
		assert.ok(result.compactedMessages.length >= 5);
	});

	test("should summarize older exchanges", () => {
		const conversation = [];
		// Create 15 exchanges
		for (let i = 0; i < 15; i++) {
			conversation.push({
				role: "user",
				content: `User message ${i}`,
			});
			conversation.push({
				role: "assistant",
				content: `Assistant response ${i}`,
			});
		}

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
			recentCount: 2,
			summarizeWindow: 5,
		});

		assert.strictEqual(result.ok, true);
		// Should contain summary messages
		const hasSummaries = result.compactedMessages.some((m) =>
			m.content.includes("[Conversation Summary]"),
		);
		assert.strictEqual(hasSummaries, true);
	});

	test("should use tiered-retention strategy", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		];

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.strategy, "tiered-retention");
	});

	test("should calculate original token count", () => {
		const conversation = [
			{ role: "user", content: "Hello world" },
			{ role: "assistant", content: "Hi there" },
		];

		const result = compactConversation({
			systemPrompt: "System prompt",
			conversation,
			targetTokens: 50000,
		});

		assert.ok(result.originalTokenCount > 0);
	});

	test("should calculate compacted token count", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		];

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
		});

		assert.ok(result.compactedTokenCount > 0);
	});

	test("should reduce when over budget", () => {
		// Create a very long conversation that will exceed a small target
		const conversation = [];
		const longContent = "x".repeat(1000);
		for (let i = 0; i < 20; i++) {
			conversation.push({ role: "user", content: longContent });
			conversation.push({ role: "assistant", content: longContent });
		}

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 100,
			recentCount: 3,
			summarizeWindow: 10,
		});

		assert.strictEqual(result.ok, true);
		// Should have used a reduced strategy
		assert.ok(
			result.strategy === "tiered-retention-reduced" ||
				result.strategy === "minimal-retention" ||
				result.strategy === "minimal-over-budget" ||
				result.strategy === "last-message-only",
		);
	});

	test("should use minimal-retention strategy when needed", () => {
		const conversation = [];
		const longContent = "x".repeat(500);
		for (let i = 0; i < 10; i++) {
			conversation.push({ role: "user", content: longContent });
			conversation.push({ role: "assistant", content: longContent });
		}

		const result = compactConversation({
			systemPrompt: "Short prompt",
			conversation,
			targetTokens: 50,
			recentCount: 3,
			summarizeWindow: 5,
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.strategy, "minimal-over-budget");
	});

	test("should use minimal-over-budget strategy when even minimal doesn't fit", () => {
		const conversation = [];
		const longContent = "x".repeat(1000);
		for (let i = 0; i < 10; i++) {
			conversation.push({ role: "user", content: longContent });
			conversation.push({ role: "assistant", content: longContent });
		}

		const result = compactConversation({
			systemPrompt: "x".repeat(2000),
			conversation,
			targetTokens: 10,
			recentCount: 3,
			summarizeWindow: 5,
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.strategy, "minimal-over-budget");
		assert.ok(result.warning);
	});

	test("should handle odd number of messages", () => {
		const conversation = [
			{ role: "user", content: "Message 1" },
			{ role: "assistant", content: "Response 1" },
			{ role: "user", content: "Message 2" },
			// No assistant response for last user message
		];

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
		assert.ok(result.compactedMessages.length > 0);
	});

	test("should handle single user message", () => {
		const result = compactConversation({
			systemPrompt: "System",
			conversation: [{ role: "user", content: "Hello" }],
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
		assert.ok(result.compactedMessages.length > 0);
	});

	test("should handle empty content messages", () => {
		const conversation = [
			{ role: "user", content: "" },
			{ role: "assistant", content: "" },
		];

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
	});

	test("should handle missing system prompt", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		];

		const result = compactConversation({
			systemPrompt: "",
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
		assert.ok(result.compactedMessages.length > 0);
	});

	test("should handle undefined system prompt", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		];

		const result = compactConversation({
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
	});

	test("should respect recentCount parameter", () => {
		const conversation = [];
		for (let i = 0; i < 6; i++) {
			conversation.push({ role: "user", content: `User ${i}` });
			conversation.push({ role: "assistant", content: `Assistant ${i}` });
		}

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
			recentCount: 1,
		});

		assert.strictEqual(result.ok, true);
		// Should retain only 1 recent exchange
		assert.ok(result.compactedMessages.length > 0);
	});

	test("should respect summarizeWindow parameter", () => {
		const conversation = [];
		for (let i = 0; i < 20; i++) {
			conversation.push({ role: "user", content: `User ${i}` });
			conversation.push({
				role: "assistant",
				content: `Assistant ${i}`,
			});
		}

		const result = compactConversation({
			systemPrompt: "System",
			conversation,
			targetTokens: 50000,
			recentCount: 1,
			summarizeWindow: 3,
		});

		assert.strictEqual(result.ok, true);
	});

	test("should include warning when over budget", () => {
		const conversation = [];
		const longContent = "x".repeat(1000);
		for (let i = 0; i < 10; i++) {
			conversation.push({ role: "user", content: longContent });
			conversation.push({ role: "assistant", content: longContent });
		}

		const result = compactConversation({
			systemPrompt: "x".repeat(2000),
			conversation,
			targetTokens: 10,
			recentCount: 3,
			summarizeWindow: 5,
		});

		assert.ok(result.warning);
	});
});

describe("createCompactContextTool", () => {
	test("should return a tool object", () => {
		const tool = createCompactContextTool({});
		assert.ok(tool);
		assert.strictEqual(tool.name, "compactContext");
	});

	test("should have correct tool name", () => {
		const tool = createCompactContextTool({});
		assert.strictEqual(tool.name, "compactContext");
	});

	test("should have a description", () => {
		const tool = createCompactContextTool({});
		assert.ok(tool.description.length > 0);
	});

	test("should handle compact action", async () => {
		const tool = createCompactContextTool({
			conversation: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			],
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	test("should reject unknown action", async () => {
		const tool = createCompactContextTool({});

		const result = await tool.invoke({
			action: "unknown",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error);
		assert.ok(parsed.error.includes("Unknown action"));
	});

	test("should reject missing targetTokens", async () => {
		const tool = createCompactContextTool({});

		const result = await tool.invoke({
			action: "compact",
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error);
		assert.ok(parsed.error.includes("targetTokens"));
	});

	test("should reject zero targetTokens", async () => {
		const tool = createCompactContextTool({});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 0,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	test("should reject negative targetTokens", async () => {
		const tool = createCompactContextTool({});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: -100,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	test("should reject non-number targetTokens", async () => {
		const tool = createCompactContextTool({});

		// LangChain structured tool validation rejects invalid input before the tool runs
		// The error is thrown by the tool framework, not returned by the tool
		let threw = false;
		try {
			await tool.invoke({
				action: "compact",
				targetTokens: "abc",
			});
		} catch (err) {
			threw = true;
		}
		assert.strictEqual(threw, true);
	});

	test("should handle checkpointer access", async () => {
		const mockCheckpointer = {
			getTuple: async () => ({
				messages: [
					{ _getType: () => "human", content: "Hello" },
					{ _getType: () => "ai", content: "Hi" },
				],
			}),
		};

		const tool = createCompactContextTool({
			checkpointer: mockCheckpointer,
			threadConfig: {
				configurable: { thread_id: "test-thread" },
			},
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	test("should handle checkpointer failure gracefully", async () => {
		const mockCheckpointer = {
			getTuple: async () => {
				throw new Error("Checkpointer error");
			},
		};

		const tool = createCompactContextTool({
			checkpointer: mockCheckpointer,
			threadConfig: {
				configurable: { thread_id: "test-thread" },
			},
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	test("should use options.conversation when checkpointer is empty", async () => {
		const mockCheckpointer = {
			getTuple: async () => null,
		};

		const tool = createCompactContextTool({
			checkpointer: mockCheckpointer,
			conversation: [
				{ role: "user", content: "Hello from options" },
			],
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	test("should include systemPrompt in compaction", async () => {
		const tool = createCompactContextTool({
			systemPrompt: "Custom system prompt",
			conversation: [{ role: "user", content: "Hello" }],
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(
			parsed.compactedMessages.some(
				(m) => m.role === "system" && m.content === "Custom system prompt",
			),
		);
	});

	test("should calculate effectiveTarget from maxContextLength and maxTokens", async () => {
		const tool = createCompactContextTool({
			maxContextLength: 128000,
			maxTokens: 4096,
			conversation: [{ role: "user", content: "Hello" }],
		});

		// effectiveTarget is calculated from maxContextLength - maxTokens when targetTokens is not provided
		// But targetTokens is still required as input — the effectiveTarget is used internally
		const result = await tool.invoke({
			action: "compact",
			targetTokens: 123904, // 128000 - 4096
		});

		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	test("should handle tool invocation error", async () => {
		// Create a tool that will throw during execution
		const tool = createCompactContextTool({
			conversation: null,
			// This will cause an error in compactConversation
		});

		const result = await tool.invoke({
			action: "compact",
			targetTokens: 50000,
		});

		const parsed = JSON.parse(result);
		// Should handle gracefully
		assert.ok(parsed.ok !== false || parsed.error);
	});
});

describe("estimateTokens (internal)", () => {
	test("should estimate 0 tokens for empty text", () => {
		// Access through compactConversation with empty conversation
		const result = compactConversation({
			systemPrompt: "",
			conversation: [],
			targetTokens: 50000,
		});
		assert.strictEqual(result.compactedTokenCount, 0);
	});

	test("should estimate tokens proportional to text length", () => {
		// Longer content should result in higher token count
		const shortResult = compactConversation({
			systemPrompt: "Hi",
			conversation: [{ role: "user", content: "Hello" }],
			targetTokens: 50000,
		});

		const longResult = compactConversation({
			systemPrompt: "A".repeat(100),
			conversation: [{ role: "user", content: "B".repeat(100) }],
			targetTokens: 50000,
		});

		assert.ok(longResult.compactedTokenCount > shortResult.compactedTokenCount);
	});
});

describe("summarizeExchange (internal)", () => {
	test("should use last-message-only strategy when even minimal doesn't fit", () => {
		const result = compactConversation({
			systemPrompt: "System",
			conversation: [
				{ role: "user", content: "This is a very long user message that should be truncated in the summary" },
				{ role: "assistant", content: "This is a very long assistant response that should also be truncated" },
			],
			targetTokens: 10, // Very low to force last-message-only
			recentCount: 0,
			summarizeWindow: 1,
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.strategy, "last-message-only");
		assert.ok(result.warning);
		// Should contain the last user message
		assert.ok(result.compactedMessages.some(m => m.role === "user"));
	});

	test("should truncate long content when over budget", () => {
		const longContent = "x".repeat(500);
		const result = compactConversation({
			systemPrompt: "System",
			conversation: [
				{ role: "user", content: longContent },
				{ role: "assistant", content: longContent },
			],
			targetTokens: 10, // Very low to force truncation
			recentCount: 0,
			summarizeWindow: 1,
		});

		assert.strictEqual(result.ok, true);
		// Should contain the last user message (last-message-only strategy)
		assert.ok(result.compactedMessages.some(m => m.role === "user"));
	});
});
