/**
 * Tests for the spreadsheet statistical operations module.
 * @see {@link src/tools/spreadsheet/stats.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as stats from "../../../src/tools/spreadsheet/stats.js";

describe("stats", () => {
	describe("mean", () => {
		it("should calculate the mean of an array", () => {
			assert.strictEqual(stats.mean([1, 2, 3, 4, 5]), 3);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.mean([]), 0);
		});

		it("should handle negative numbers", () => {
			assert.strictEqual(stats.mean([-1, 0, 1]), 0);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.mean([42]), 42);
		});

		it("should handle decimals", () => {
			assert.strictEqual(stats.mean([1.5, 2.5, 3.5]), 2.5);
		});
	});

	describe("median", () => {
		it("should calculate the median of an odd-length array", () => {
			assert.strictEqual(stats.median([1, 3, 5]), 3);
		});

		it("should calculate the median of an even-length array", () => {
			assert.strictEqual(stats.median([1, 3, 5, 7]), 4);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.median([]), 0);
		});

		it("should handle unsorted input", () => {
			assert.strictEqual(stats.median([5, 1, 3]), 3);
		});

		it("should handle negative numbers", () => {
			assert.strictEqual(stats.median([-5, -1, -3]), -3);
		});
	});

	describe("mode", () => {
		it("should return the most frequent value", () => {
			assert.strictEqual(stats.mode([1, 2, 2, 3, 3, 3, 4]), 3);
		});

		it("should return the first mode for multimodal arrays", () => {
			const result = stats.mode([1, 1, 2, 2]);
			assert.ok(result === 1 || result === 2);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.mode([]), 0);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.mode([42]), 42);
		});
	});

	describe("stddev", () => {
		it("should calculate the standard deviation", () => {
			const result = stats.stddev([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 2) < 0.01);
		});

		it("should return 0 for a single value", () => {
			assert.strictEqual(stats.stddev([5]), 0);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.stddev([]), 0);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.stddev([3, 3, 3, 3]), 0);
		});
	});

	describe("variance", () => {
		it("should calculate the variance", () => {
			const result = stats.variance([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 4) < 0.01);
		});

		it("should return 0 for a single value", () => {
			assert.strictEqual(stats.variance([5]), 0);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.variance([]), 0);
		});
	});

	describe("percentile", () => {
		it("should calculate the 50th percentile (median)", () => {
			assert.strictEqual(stats.percentile([1, 2, 3, 4, 5], 50), 3);
		});

		it("should calculate the 0th percentile (min)", () => {
			assert.strictEqual(stats.percentile([1, 2, 3, 4, 5], 0), 1);
		});

		it("should calculate the 100th percentile (max)", () => {
			assert.strictEqual(stats.percentile([1, 2, 3, 4, 5], 100), 5);
		});

		it("should return 0 for an empty array", () => {
			assert.strictEqual(stats.percentile([], 50), 0);
		});

		it("should handle percentile interpolation", () => {
			const result = stats.percentile([1, 2, 3, 4], 25);
			assert.ok(result >= 1 && result <= 2);
		});
	});
});
