/**
 * Tests for the timing-aware streaming segment coalescing logic.
 * @see {@link src/tui/messageList.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { coalesceSegments, SEGMENT_COALESCE_TIMEOUT_MS } from "../../../src/tui/messageList.js";

describe("coalesceSegments", () => {
	it("exports a 500ms default timeout constant", () => {
		assert.strictEqual(SEGMENT_COALESCE_TIMEOUT_MS, 500);
	});

	describe("same-type transitions", () => {
		it("appends message content to the last message segment", () => {
			const existing = [{ type: "message", content: "Hello", time: 1000 }];
			const result = coalesceSegments(existing, { type: "message", content: " world", time: 1050 });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hello world");
		});

		it("appends reasoning content to the last reasoning segment", () => {
			const existing = [{ type: "reasoning", content: "thinking", time: 1000 }];
			const result = coalesceSegments(existing, {
				type: "reasoning",
				content: " more",
				time: 1050,
			});
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "thinking more");
		});
	});

	describe("reasoning → message transitions", () => {
		it("appends to last message segment when no punctuation and within timeout", () => {
			const existing = [
				{ type: "message", content: "The answer is", time: 1000 },
				{ type: "reasoning", content: "thinking", time: 1100 },
			];
			const result = coalesceSegments(existing, { type: "message", content: " 42", time: 1200 });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[0].content, "The answer is 42");
			assert.strictEqual(result.segments[1].type, "reasoning");
		});

		it("pushes a new message segment when the last message anchor ends with punctuation", () => {
			const existing = [
				{ type: "message", content: "The answer is 42.", time: 1000 },
				{ type: "reasoning", content: "thinking", time: 1100 },
			];
			const result = coalesceSegments(existing, { type: "message", content: " Next", time: 1200 });
			assert.strictEqual(result.segments.length, 3);
			assert.strictEqual(result.segments[2].type, "message");
			assert.strictEqual(result.segments[2].content, " Next");
		});

		it("pushes a new message segment when the gap exceeds the timeout", () => {
			const existing = [
				{ type: "message", content: "The answer is", time: 1000 },
				{ type: "reasoning", content: "thinking", time: 1100 },
			];
			const result = coalesceSegments(existing, { type: "message", content: " 42", time: 2000 });
			assert.strictEqual(result.segments.length, 3);
			assert.strictEqual(result.segments[2].type, "message");
			assert.strictEqual(result.segments[2].content, " 42");
		});

		it("pushes a new message segment when no message anchor exists", () => {
			const existing = [{ type: "reasoning", content: "thinking", time: 1000 }];
			const result = coalesceSegments(existing, { type: "message", content: "Hello", time: 1050 });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[1].type, "message");
			assert.strictEqual(result.segments[1].content, "Hello");
		});
	});

	describe("message → reasoning transitions", () => {
		it("appends to last reasoning segment when within timeout", () => {
			const existing = [
				{ type: "reasoning", content: "thinking", time: 1000 },
				{ type: "message", content: "Hello", time: 1100 },
			];
			const result = coalesceSegments(existing, {
				type: "reasoning",
				content: " more",
				time: 1200,
			});
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[0].content, "thinking more");
			assert.strictEqual(result.segments[1].type, "message");
		});

		it("pushes a new reasoning segment when the gap exceeds the timeout", () => {
			const existing = [
				{ type: "reasoning", content: "thinking", time: 1000 },
				{ type: "message", content: "Hello", time: 1100 },
			];
			const result = coalesceSegments(existing, {
				type: "reasoning",
				content: " more",
				time: 2000,
			});
			assert.strictEqual(result.segments.length, 3);
			assert.strictEqual(result.segments[2].type, "reasoning");
			assert.strictEqual(result.segments[2].content, " more");
		});

		it("pushes a new reasoning segment when no reasoning anchor exists", () => {
			const existing = [{ type: "message", content: "Hello", time: 1000 }];
			const result = coalesceSegments(existing, {
				type: "reasoning",
				content: "thinking",
				time: 1050,
			});
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[1].type, "reasoning");
			assert.strictEqual(result.segments[1].content, "thinking");
		});
	});

	describe("edge cases", () => {
		it("handles an empty existing segment list by pushing the new segment", () => {
			const result = coalesceSegments([], { type: "message", content: "Hello", time: 1000 });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hello");
		});

		it("treats missing timestamps as within timeout (backward compatible)", () => {
			const existing = [{ type: "message", content: "Hello" }];
			const result = coalesceSegments(existing, { type: "message", content: " world" });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hello world");
		});

		it("returns a null gap when timestamps are missing", () => {
			const existing = [{ type: "message", content: "Hello" }];
			const result = coalesceSegments(existing, { type: "message", content: " world" });
			assert.strictEqual(result.gap, null);
		});

		it("drops a trivial reasoning segment with no alphanumeric content", () => {
			const existing = [{ type: "message", content: "Hey, Jason" }];
			const result = coalesceSegments(existing, { type: "reasoning", content: "." });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hey, Jason");
		});

		it("keeps a reasoning segment with alphanumeric content", () => {
			const existing = [{ type: "message", content: "Hey, Jason" }];
			const result = coalesceSegments(existing, {
				type: "reasoning",
				content: "Let me check the date.",
			});
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[1].content, "Let me check the date.");
		});
	});
});
