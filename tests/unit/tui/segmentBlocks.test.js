/**
 * Tests for the segment block coalescing logic.
 * @see {@link src/tui/segmentBlocks.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	createBlockTracker,
	shouldStartNewBlock,
	upsertSegment,
} from "../../../src/tui/segmentBlocks.js";

describe("segmentBlocks — createBlockTracker", () => {
	it("initializes empty blocks and no last segment", () => {
		const tracker = createBlockTracker();
		assert.deepStrictEqual(tracker.blocks, { message: null, reasoning: null });
		assert.strictEqual(tracker.last, null);
	});
});

describe("segmentBlocks — shouldStartNewBlock", () => {
	it("starts a new block on the first segment of a type", () => {
		const tracker = createBlockTracker();
		assert.strictEqual(shouldStartNewBlock(tracker, "message"), true);
		assert.strictEqual(shouldStartNewBlock(tracker, "reasoning"), true);
	});

	it("appends same-type segments regardless of pause", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "reasoning", "thinking", 1000);
		// A long pause later — still same type, still appends
		assert.strictEqual(shouldStartNewBlock(tracker, "reasoning"), false);
	});

	it("splits on type transition when the last block ended with a sentence boundary", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "message", "The answer is 42.", 1000);
		// Reasoning arrives after a completed message sentence → new block
		assert.strictEqual(shouldStartNewBlock(tracker, "reasoning"), true);
	});

	it("does not split a message block when reasoning interleaves mid-sentence", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "message", "The answer is", 1000);
		upsertSegment(tracker, "reasoning", "…", 1100);
		// A message segment arriving after reasoning (mid-sentence) appends — no split
		assert.strictEqual(shouldStartNewBlock(tracker, "message"), false);
	});
});

describe("segmentBlocks — upsertSegment", () => {
	it("creates a block on first segment and returns newBlock true", () => {
		const tracker = createBlockTracker();
		const newBlock = upsertSegment(tracker, "reasoning", "thinking", 1000);
		assert.strictEqual(newBlock, true);
		assert.strictEqual(tracker.blocks.reasoning.content, "thinking");
		assert.deepStrictEqual(tracker.last, { type: "reasoning", content: "thinking", time: 1000 });
	});

	it("appends same-type segments into one continuous block", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "reasoning", "thinking", 1000);
		upsertSegment(tracker, "reasoning", " deeper", 5000); // long pause, same type
		assert.strictEqual(tracker.blocks.reasoning.content, "thinking deeper");
		assert.strictEqual(tracker.blocks.reasoning.time, 5000);
	});

	it("coalesces message segments across an interleaved reasoning gap", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "message", "The answer is", 1000);
		upsertSegment(tracker, "reasoning", "…", 1100);
		upsertSegment(tracker, "message", " 42", 1200);
		assert.strictEqual(tracker.blocks.message.content, "The answer is 42");
		assert.strictEqual(tracker.blocks.reasoning.content, "…");
	});

	it("splits reasoning into a new block after a completed message sentence", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "message", "Done.", 1000);
		const newBlock = upsertSegment(tracker, "reasoning", "next thought", 1100);
		assert.strictEqual(newBlock, true);
		assert.strictEqual(tracker.blocks.reasoning.content, "next thought");
	});

	it("keeps a continuous reasoning stream as one block across sentence breaks", () => {
		const tracker = createBlockTracker();
		upsertSegment(tracker, "reasoning", "First thought.", 1000);
		const newBlock = upsertSegment(tracker, "reasoning", " Second thought.", 2000);
		assert.strictEqual(newBlock, false);
		assert.strictEqual(tracker.blocks.reasoning.content, "First thought. Second thought.");
	});
});
