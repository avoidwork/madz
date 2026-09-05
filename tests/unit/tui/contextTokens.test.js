/**
 * Unit tests for the conversation token calculator.
 * @module tests/unit/tui/contextTokens.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { calculateConversationTokens } from "../../../src/tui/contextTokens.js";

describe("calculateConversationTokens", () => {
	it("returns 0 for empty conversation", () => {
		assert.strictEqual(calculateConversationTokens([], "gpt-4o"), 0);
	});

	it("returns 0 for null conversation", () => {
		assert.strictEqual(calculateConversationTokens(null, "gpt-4o"), 0);
	});

	it("returns 0 for undefined conversation", () => {
		assert.strictEqual(calculateConversationTokens(undefined, "gpt-4o"), 0);
	});

	it("calculates tokens for a simple message using tiktoken", () => {
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("calculates tokens for multiple messages", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there! How can I help you today?" },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with empty content", () => {
		const conversation = [
			{ role: "user", content: "" },
			{ role: "assistant", content: "Response" },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("handles messages with null content", () => {
		const conversation = [
			{ role: "user", content: null },
			{ role: "assistant", content: "Response" },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("uses explicit encoding parameter", () => {
		const conversation = [{ role: "user", content: "Test message" }];
		const tokens = calculateConversationTokens(conversation, "gpt-4o", "cl100k_base");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("uses OPENAI_ENCODING env var when set", () => {
		const original = process.env.OPENAI_ENCODING;
		process.env.OPENAI_ENCODING = "cl100k_base";
		try {
			const conversation = [{ role: "user", content: "Test" }];
			const tokens = calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
		} finally {
			if (original) {
				process.env.OPENAI_ENCODING = original;
			} else {
				delete process.env.OPENAI_ENCODING;
			}
		}
	});

	it("falls back to character estimation when model name is unknown", () => {
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = calculateConversationTokens(conversation, "unknown-model-12345");
		assert.ok(typeof tokens === "number");
	});

	it("falls back to character estimation when encoding fails", () => {
		// Use a model name that will cause encoding_for_model to fail
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = calculateConversationTokens(conversation, "");
		assert.ok(typeof tokens === "number");
	});

	it("estimates tokens from characters when tiktoken is unavailable", () => {
		// Temporarily break tiktoken by using a model that doesn't exist
		const conversation = [{ role: "user", content: "a".repeat(100) }];
		const tokens = calculateConversationTokens(conversation, "nonexistent-model-xyz");
		assert.ok(typeof tokens === "number");
		// ~4 chars per token, so 100 chars ≈ 25 tokens
		assert.ok(tokens >= 20 && tokens <= 30);
	});

	it("handles long conversations", () => {
		const conversation = Array.from({ length: 10 }, (_, i) => ({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `This is message number ${i + 1} with some content to encode.`,
		}));
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with special characters", () => {
		const conversation = [
			{ role: "user", content: "Hello! @#$%^&*()_+-=[]{}|;':\",./<>?`~" },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with unicode characters", () => {
		const conversation = [
			{ role: "user", content: "Hello, 世界! 🌍" },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with only whitespace", () => {
		const conversation = [
			{ role: "user", content: "   " },
		];
		const tokens = calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("derives encoding from model name when no encoding specified", () => {
		const conversation = [{ role: "user", content: "Test" }];
		// modelName split on ":" takes first part
		const tokens = calculateConversationTokens(conversation, "gpt-4o:some-version");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});
});
