/**
 * Tests for the streaming segment coalescing logic.
 * @see {@link src/tui/messageList.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { coalesceSegments } from "../../../src/tui/messageList.js";

describe("coalesceSegments", () => {
	describe("same-type transitions", () => {
		it("appends message content to the last message segment", () => {
			const existing = [{ type: "message", content: "Hello" }];
			const result = coalesceSegments(existing, { type: "message", content: " world" });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hello world");
		});

		it("appends reasoning content to the last reasoning segment", () => {
			const existing = [{ type: "reasoning", content: "thinking" }];
			const result = coalesceSegments(existing, { type: "reasoning", content: " more" });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "thinking more");
		});
	});

	describe("reasoning → message transitions", () => {
		it("appends to the last message segment across a reasoning gap", () => {
			const existing = [
				{ type: "message", content: "The answer is" },
				{ type: "reasoning", content: "thinking" },
			];
			const result = coalesceSegments(existing, { type: "message", content: " 42" });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[0].content, "The answer is 42");
			assert.strictEqual(result.segments[1].type, "reasoning");
		});

		it("appends even when the last message anchor ends with punctuation", () => {
			const existing = [
				{ type: "message", content: "The answer is 42." },
				{ type: "reasoning", content: "thinking" },
			];
			const result = coalesceSegments(existing, { type: "message", content: " Next" });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[0].content, "The answer is 42. Next");
			assert.strictEqual(result.segments[1].type, "reasoning");
		});

		it("pushes a new message segment when no message anchor exists", () => {
			const existing = [{ type: "reasoning", content: "thinking" }];
			const result = coalesceSegments(existing, { type: "message", content: "Hello" });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[1].type, "message");
			assert.strictEqual(result.segments[1].content, "Hello");
		});
	});

	describe("message → reasoning transitions", () => {
		it("appends to the last reasoning segment across a message gap", () => {
			const existing = [
				{ type: "reasoning", content: "thinking" },
				{ type: "message", content: "Hello" },
			];
			const result = coalesceSegments(existing, { type: "reasoning", content: " more" });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[0].content, "thinking more");
			assert.strictEqual(result.segments[1].type, "message");
		});

		it("pushes a new reasoning segment when no reasoning anchor exists", () => {
			const existing = [{ type: "message", content: "Hello" }];
			const result = coalesceSegments(existing, { type: "reasoning", content: "thinking" });
			assert.strictEqual(result.segments.length, 2);
			assert.strictEqual(result.segments[1].type, "reasoning");
			assert.strictEqual(result.segments[1].content, "thinking");
		});
	});

	describe("trivial reasoning noise", () => {
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

		it("appends a trivial reasoning chunk when the last segment is reasoning", () => {
			const existing = [{ type: "reasoning", content: "thinking" }];
			const result = coalesceSegments(existing, { type: "reasoning", content: "." });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "thinking.");
		});
	});

	describe("edge cases", () => {
		it("handles an empty existing segment list by pushing the new segment", () => {
			const result = coalesceSegments([], { type: "message", content: "Hello" });
			assert.strictEqual(result.segments.length, 1);
			assert.strictEqual(result.segments[0].content, "Hello");
		});
	});
});
