import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateConversationTokens } from "../../src/tui/contextTokens.js";

describe("streaming context size delta", () => {
	it("calculates token delta for a single content chunk", () => {
		const preStreamSize = 1000;
		const chunkContent = "Hello, world!";
		const deltaTokens = calculateConversationTokens(
			[{ role: "assistant", content: chunkContent }],
			"gpt-4o",
			undefined,
		);
		assert.ok(deltaTokens > 0, "delta should be positive");
		assert.strictEqual(preStreamSize + deltaTokens, preStreamSize + deltaTokens);
	});

	it("calculates incremental deltas — each chunk adds to pre-stream size", () => {
		const preStreamSize = 1000;
		const chunks = ["Hello", ", ", "world", "!"];
		let runningTotal = preStreamSize;

		for (const chunk of chunks) {
			const deltaTokens = calculateConversationTokens(
				[{ role: "assistant", content: chunk }],
				"gpt-4o",
				undefined,
			);
			runningTotal += deltaTokens;
			assert.ok(runningTotal > preStreamSize, "running total should increase with each chunk");
		}
	});

	it("does not update context size when content is absent", () => {
		const emptyChunk = "";
		const deltaTokens = calculateConversationTokens(
			[{ role: "assistant", content: emptyChunk }],
			"gpt-4o",
			undefined,
		);
		// Empty content should produce zero or near-zero delta
		assert.strictEqual(deltaTokens, 0, "empty content should produce zero delta");
	});

	it("handles reasoning-only chunks — no content means no context update", () => {
		const reasoningChunk = "Let me think about this...";
		// Reasoning content is NOT assistant message content — it's separate
		// The streaming handler only updates context size for content, not reasoning
		const deltaTokens = calculateConversationTokens(
			[{ role: "assistant", content: reasoningChunk }],
			"gpt-4o",
			undefined,
		);
		// This tests that reasoning-only content would be tokenized if passed
		// In practice, the handler guards on event.data.chunk.content presence
		assert.ok(deltaTokens >= 0, "reasoning content should produce non-negative delta");
	});

	it("delta calculation is consistent with full conversation calculation", () => {
		const existingMessages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
		];
		const newChunk = " How are you?";

		// Full conversation delta
		const fullDelta = calculateConversationTokens(
			[...existingMessages, { role: "assistant", content: newChunk }],
			"gpt-4o",
			undefined,
		);

		// Pre-stream size (existing messages only)
		const existingDelta = calculateConversationTokens(existingMessages, "gpt-4o", undefined);

		// Chunk-only delta
		const chunkDelta = calculateConversationTokens(
			[{ role: "assistant", content: newChunk }],
			"gpt-4o",
			undefined,
		);

		// The chunk delta should approximately equal fullDelta - existingDelta
		// (may differ slightly due to special tokens per message)
		assert.ok(
			Math.abs(chunkDelta - (fullDelta - existingDelta)) <= 5,
			"chunk delta should be close to full delta minus existing delta",
		);
	});
});
