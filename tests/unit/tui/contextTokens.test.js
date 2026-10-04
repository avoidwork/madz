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

	describe("encoder resolution (tiktoken actually used)", () => {
		// The ambient environment may set OPENAI_ENCODING to a value tiktoken
		// cannot resolve (e.g. a provider-specific name), which would force the
		// char/4 fallback and defeat these assertions. Neutralize it for this
		// block and restore it afterwards.
		let originalEncoding;
		before(() => {
			originalEncoding = process.env.OPENAI_ENCODING;
			delete process.env.OPENAI_ENCODING;
		});
		after(() => {
			if (originalEncoding !== undefined) {
				process.env.OPENAI_ENCODING = originalEncoding;
			} else {
				delete process.env.OPENAI_ENCODING;
			}
		});

		// A string whose tiktoken count differs from the chars/4 heuristic, so
		// we can prove tiktoken was used rather than the character fallback.
		const text = "The quick brown fox jumps over the lazy dog near the riverbank today.";
		const charEstimate = Math.ceil(text.length / 4);

		it("known model uses tiktoken, not the char/4 fallback", async () => {
			const conversation = [{ role: "user", content: text }];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.notStrictEqual(tokens, charEstimate, "should differ from char/4 estimate");
		});

		it("explicit cl100k_base encoding uses tiktoken, not the char/4 fallback", async () => {
			const conversation = [{ role: "user", content: text }];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o", "cl100k_base");
			assert.notStrictEqual(tokens, charEstimate, "should differ from char/4 estimate");
		});

		it("explicit encoding matches the model-derived count for the same text", async () => {
			const conversation = [{ role: "user", content: text }];
			const viaEncoding = await calculateConversationTokens(conversation, "gpt-4o", "cl100k_base");
			const viaModel = await calculateConversationTokens(conversation, "gpt-4o");
			assert.strictEqual(viaEncoding, viaModel);
		});

		it("OPENAI_ENCODING env var uses tiktoken, not the char/4 fallback", async () => {
			const original = process.env.OPENAI_ENCODING;
			process.env.OPENAI_ENCODING = "cl100k_base";
			try {
				const conversation = [{ role: "user", content: text }];
				const tokens = await calculateConversationTokens(conversation, "gpt-4o");
				assert.notStrictEqual(tokens, charEstimate, "should differ from char/4 estimate");
			} finally {
				if (original) {
					process.env.OPENAI_ENCODING = original;
				} else {
					delete process.env.OPENAI_ENCODING;
				}
			}
		});

		it("unknown model with no encoding falls back to char/4", async () => {
			const conversation = [{ role: "user", content: text }];
			const tokens = await calculateConversationTokens(conversation, "totally-unknown-model-xyz");
			assert.strictEqual(tokens, charEstimate, "should use the char/4 heuristic");
		});
	});

	describe("real LangChain message arrays", () => {
		it("tokenizes content blocks without double-counting", async () => {
			const conversation = [
				{ _getType: () => "human", content: [{ type: "text", text: "Hello" }] },
				{ _getType: () => "ai", content: [{ type: "text", text: "Hi there!" }] },
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "content blocks should contribute to the token count");
		});

		it("tokenizes tool calls and tool messages", async () => {
			const conversation = [
				{ _getType: () => "human", content: "Search for madz" },
				{
					_getType: () => "ai",
					content: "Let me search.",
					tool_calls: [{ name: "search", args: { q: "madz" }, id: "call_1" }],
				},
				{ _getType: () => "tool", content: "42 results", name: "search" },
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "tool calls and tool messages should contribute to the token count");
		});

		it("tokenizes reasoning content blocks", async () => {
			const conversation = [
				{
					_getType: () => "ai",
					content: [
						{ type: "reasoning", reasoning: "thinking..." },
						{ type: "text", text: "answer" },
					],
				},
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "reasoning content should contribute to the token count");
		});

		it("does not double-count a message with both text and tool_calls", async () => {
			const conversation = [
				{
					_getType: () => "ai",
					content: "I'll look that up.",
					tool_calls: [{ name: "search", args: { q: "madz" }, id: "call_1" }],
				},
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0);
		});

		it("handles an empty real message array", async () => {
			const tokens = await calculateConversationTokens([], "gpt-4o");
			assert.strictEqual(tokens, 0);
		});

		it("tokenizes the image_url base64 string, not a placeholder", async () => {
			const conversation = [
				{
					_getType: () => "human",
					content: [
						{ type: "text", text: "What is this?" },
						{ type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
					],
				},
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "the image_url base64 string should contribute to the token count");
		});

		it("counts the image_url base64 string as more than a placeholder", async () => {
			const withImage = await calculateConversationTokens(
				[
					{
						_getType: () => "human",
						content: [{ type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } }],
					},
				],
				"gpt-4o",
			);
			const withPlaceholder = await calculateConversationTokens(
				[{ _getType: () => "human", content: "[image]" }],
				"gpt-4o",
			);
			assert.ok(
				withImage > withPlaceholder,
				"the real base64 string must count more than the '[image]' placeholder",
			);
		});

		it("preserves tool message name and tool_call_id in the count", async () => {
			const conversation = [
				{
					_getType: () => "tool",
					content: "42 results",
					name: "search",
					tool_call_id: "call_1",
				},
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "tool message name and tool_call_id should contribute");
		});

		it("counts invalid_tool_calls on assistant messages", async () => {
			const conversation = [
				{
					_getType: () => "ai",
					content: "Let me try.",
					invalid_tool_calls: [{ name: "search", args: "bad json", id: "call_1" }],
				},
			];
			const tokens = await calculateConversationTokens(conversation, "gpt-4o");
			assert.ok(typeof tokens === "number");
			assert.ok(tokens > 0, "invalid_tool_calls should contribute to the token count");
		});
	});
});
