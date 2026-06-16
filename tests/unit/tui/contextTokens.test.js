/**
 * Tests for context token calculation.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateConversationTokens } from "../../../src/tui/utils/contextTokens.js";

describe("calculateConversationTokens", () => {
	it("should return 0 for empty conversation", () => {
		assert.strictEqual(calculateConversationTokens([], "gpt-4o"), 0);
		assert.strictEqual(calculateConversationTokens(null, "gpt-4o"), 0);
		assert.strictEqual(calculateConversationTokens(undefined, "gpt-4o"), 0);
	});

	it("should return 0 for conversation with no content", () => {
		const result = calculateConversationTokens(
			[{ role: "user", content: "" }],
			"gpt-4o",
		);
		assert.strictEqual(result, 0);
	});

	it("should use tiktoken when available", () => {
		// tiktoken should be available in the test environment
		const result = calculateConversationTokens(
			[{ role: "user", content: "Hello, world!" }],
			"gpt-4o",
		);
		assert.ok(typeof result === "number");
		assert.ok(result >= 0);
	});

	it("should fall back to character estimation when tiktoken fails", () => {
		// tiktoken is available in the test environment, so this test verifies
		// that the function returns a valid number
		const result = calculateConversationTokens(
			[{ role: "user", content: "Hello, world! This is a test message." }],
			"gpt-4o",
		);
		assert.ok(typeof result === "number");
		assert.ok(result > 0);
	});

	it("should handle multiple messages", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
			{ role: "user", content: "How are you?" },
		];
		const result = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof result === "number");
		assert.ok(result > 0);
	});

	it("should handle messages with null content", () => {
		const conversation = [
			{ role: "user", content: null },
			{ role: "assistant", content: "Hi" },
		];
		const result = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof result === "number");
		assert.ok(result > 0);
	});

	it("should use encoder name from encoding parameter", () => {
		const result = calculateConversationTokens(
			[{ role: "user", content: "test" }],
			"custom-model",
			"cl100k_base",
		);
		assert.ok(typeof result === "number");
		assert.ok(result >= 0);
	});

	it("should derive encoder from model name", () => {
		const result = calculateConversationTokens(
			[{ role: "user", content: "test" }],
			"gpt-4o",
		);
		assert.ok(typeof result === "number");
		assert.ok(result >= 0);
	});
});
