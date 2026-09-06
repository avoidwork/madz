import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { calculateConversationTokens } from "../../../src/tui/contextTokens.js";

describe("calculateConversationTokens", () => {
	it("returns 0 for empty conversation", async () => {
		assert.strictEqual(await calculateConversationTokens([], "gpt-4o"), 0);
	});

	it("returns 0 for null conversation", async () => {
		assert.strictEqual(await calculateConversationTokens(null, "gpt-4o"), 0);
	});

	it("returns 0 for undefined conversation", async () => {
		assert.strictEqual(await calculateConversationTokens(undefined, "gpt-4o"), 0);
	});

	it("calculates tokens for a simple message using tiktoken", async () => {
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("calculates tokens for multiple messages", async () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there! How can I help you today?" },
		];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with empty content", async () => {
		const conversation = [
			{ role: "user", content: "" },
			{ role: "assistant", content: "Response" },
		];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("handles messages with null content", async () => {
		const conversation = [
			{ role: "user", content: null },
			{ role: "assistant", content: "Response" },
		];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("uses explicit encoding parameter", async () => {
		const conversation = [{ role: "user", content: "Test message" }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o", "cl100k_base");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("uses OPENAI_ENCODING env var when set", async () => {
		const original = process.env.OPENAI_ENCODING;
		process.env.OPENAI_ENCODING = "cl100k_base";
		try {
			const conversation = [{ role: "user", content: "Test" }];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
		} finally {
			if (original) {
				process.env.OPENAI_ENCODING = original;
			} else {
				delete process.env.OPENAI_ENCODING;
			}
		}
	});

	it("falls back to character estimation when model name is unknown", async () => {
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = await calculateConversationTokens(conversation, "unknown-model-12345");
		assert.ok(typeof tokens === "number");
	});

	it("falls back to character estimation when encoding fails", async () => {
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const tokens = await calculateConversationTokens(conversation, "");
		assert.ok(typeof tokens === "number");
	});

	it("estimates tokens from characters when tiktoken is unavailable", async () => {
		const conversation = [{ role: "user", content: "a".repeat(100) }];
		const tokens = await calculateConversationTokens(conversation, "nonexistent-model-xyz");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens >= 20 && tokens <= 30);
	});

	it("handles long conversations", async () => {
		const conversation = Array.from({ length: 10 }, (_, i) => ({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `This is message number ${i + 1} with some content to encode.`,
		}));
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with special characters", async () => {
		const conversation = [{ role: "user", content: "Hello! @#$%^&*()_+-=[]{}|;':\",./<>?`~" }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with unicode characters", async () => {
		const conversation = [{ role: "user", content: "Hello, 世界! 🌍" }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with only whitespace", async () => {
		const conversation = [{ role: "user", content: "   " }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
	});

	it("derives encoding from model name when no encoding specified", async () => {
		const conversation = [{ role: "user", content: "Test" }];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o:some-version");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});

	it("handles messages with no content property", async () => {
		const conversation = [
			{ role: "user", content: "hello" },
			{ role: "assistant" },
			{ role: "user", content: "world" },
		];
		const tokens = await calculateConversationTokens(conversation, "gpt-4o");
		assert.ok(typeof tokens === "number");
		assert.ok(tokens > 0);
	});
});
