/**
 * Tests for the VirtualScrollView pure functions.
 * @see {@link src/tui/scrollView.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { computeVisibleRange } from "../../../src/tui/scrollView.js";

describe("computeVisibleRange", () => {
	it("returns an empty range for an empty height list", () => {
		const result = computeVisibleRange([], 10, 0, 0);
		assert.deepStrictEqual(result, { start: 0, end: 0, offsets: [], totalHeight: 0 });
	});

	it("returns the full range when all items fit in the viewport", () => {
		const heights = [2, 2, 2];
		const result = computeVisibleRange(heights, 10, 0, 0);
		assert.strictEqual(result.start, 0);
		assert.strictEqual(result.end, 3);
		assert.strictEqual(result.totalHeight, 6);
		assert.deepStrictEqual(result.offsets, [0, 2, 4]);
	});

	it("computes cumulative offsets correctly", () => {
		const heights = [3, 5, 2, 4];
		const result = computeVisibleRange(heights, 10, 0, 0);
		assert.deepStrictEqual(result.offsets, [0, 3, 8, 10]);
		assert.strictEqual(result.totalHeight, 14);
	});

	it("returns only the visible range when content overflows the viewport", () => {
		const heights = [10, 10, 10, 10, 10];
		const result = computeVisibleRange(heights, 10, 0, 0);
		// Only the first item fits in the viewport at scroll offset 0.
		assert.strictEqual(result.start, 0);
		assert.strictEqual(result.end, 1);
	});

	it("expands the range by overscan on each side", () => {
		const heights = [10, 10, 10, 10, 10, 10, 10];
		const result = computeVisibleRange(heights, 10, 0, 2);
		// Visible item is index 0; overscan 2 expands to [0, 3).
		assert.strictEqual(result.start, 0);
		assert.strictEqual(result.end, 3);
	});

	it("clamps the start to 0 when overscan exceeds the top", () => {
		const heights = [10, 10, 10, 10, 10];
		const result = computeVisibleRange(heights, 10, 20, 5);
		assert.strictEqual(result.start, 0);
	});

	it("clamps the end to the item count when overscan exceeds the bottom", () => {
		const heights = [10, 10, 10, 10, 10];
		const result = computeVisibleRange(heights, 10, 0, 10);
		assert.strictEqual(result.end, 5);
	});

	it("finds the visible range at a mid scroll offset", () => {
		const heights = [5, 5, 5, 5, 5, 5, 5, 5];
		// Viewport 10, scroll offset 15 → items 3 and 4 are visible.
		const result = computeVisibleRange(heights, 10, 15, 0);
		assert.strictEqual(result.start, 3);
		assert.strictEqual(result.end, 5);
	});

	it("handles a single short message", () => {
		const heights = [1];
		const result = computeVisibleRange(heights, 10, 0, 0);
		assert.strictEqual(result.start, 0);
		assert.strictEqual(result.end, 1);
		assert.strictEqual(result.totalHeight, 1);
	});

	it("handles messages shorter than the viewport", () => {
		const heights = [1, 1, 1, 1, 1];
		const result = computeVisibleRange(heights, 10, 0, 0);
		assert.strictEqual(result.start, 0);
		assert.strictEqual(result.end, 5);
	});

	it("handles scroll-to-bottom", () => {
		const heights = [10, 10, 10, 10, 10];
		const viewport = 10;
		const total = 50;
		const scrollOffset = total - viewport; // 40
		const result = computeVisibleRange(heights, viewport, scrollOffset, 0);
		assert.strictEqual(result.start, 4);
		assert.strictEqual(result.end, 5);
	});
});
