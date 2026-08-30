/**
 * Tests for the spreadsheet statistical operations module.
 * @see {@link src/tools/spreadsheet/stats.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as stats from "../../../../src/tools/spreadsheet/stats.js";

describe("stats", () => {
	describe("mean", () => {
		it("should calculate the mean of an array", () => {
			assert.strictEqual(stats.mean([1, 2, 3, 4, 5]), 3);
		});

		it("should throw for an empty array", () => {
			assert.throws(() => stats.mean([]), /requires a non-empty array/);
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

		it("should throw for an empty array", () => {
			assert.throws(() => stats.median([]), /requires a non-empty array/);
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
			const result = stats.mode([1, 2, 2, 3, 3, 3, 4]);
			assert.deepStrictEqual(result, [3]);
		});

		it("should return all modes for multimodal arrays", () => {
			const result = stats.mode([1, 1, 2, 2]);
			assert.deepStrictEqual(result, [1, 2]);
		});

		it("should return empty array for an empty array", () => {
			assert.deepStrictEqual(stats.mode([]), []);
		});

		it("should return empty array for single value (no mode)", () => {
			assert.deepStrictEqual(stats.mode([42]), []);
		});
	});

	describe("stddev", () => {
		it("should calculate the standard deviation", () => {
			const result = stats.stddev([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 2.14) < 0.01);
		});

		it("should throw for a single value", () => {
			assert.throws(() => stats.stddev([5]), /requires at least 2 numbers/);
		});

		it("should throw for an empty array", () => {
			assert.throws(() => stats.stddev([]), /requires at least 2 numbers/);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.stddev([3, 3, 3, 3]), 0);
		});
	});

	describe("variance", () => {
		it("should calculate the variance", () => {
			const result = stats.variance([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 4.57) < 0.01);
		});

		it("should throw for a single value", () => {
			assert.throws(() => stats.variance([5]), /requires at least 2 numbers/);
		});

		it("should throw for an empty array", () => {
			assert.throws(() => stats.variance([]), /requires at least 2 numbers/);
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

		it("should throw for an empty array", () => {
			assert.throws(() => stats.percentile([], 50), /requires a non-empty array/);
		});

		it("should handle percentile interpolation", () => {
			const result = stats.percentile([1, 2, 3, 4], 25);
			assert.ok(result >= 1 && result <= 2);
		});

		it("should throw for p out of range", () => {
			assert.throws(() => stats.percentile([1, 2, 3], -1), /between 0 and 100/);
			assert.throws(() => stats.percentile([1, 2, 3], 101), /between 0 and 100/);
		});

		it("should return single value for single-element array", () => {
			assert.strictEqual(stats.percentile([42], 50), 42);
		});
	});

	describe("populationStddev", () => {
		it("should calculate population standard deviation", () => {
			const result = stats.populationStddev([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 2) < 0.01);
		});

		it("should throw for an empty array", () => {
			assert.throws(() => stats.populationStddev([]), /non-empty array/);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.populationStddev([3, 3, 3, 3]), 0);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.populationStddev([42]), 0);
		});

		it("should handle non-numeric values gracefully", () => {
			const result = stats.populationStddev([1, "2", "hello", 4]);
			assert.ok(typeof result === "number");
		});
	});

	describe("populationVariance", () => {
		it("should calculate population variance", () => {
			const result = stats.populationVariance([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 4) < 0.01);
		});

		it("should throw for an empty array", () => {
			assert.throws(() => stats.populationVariance([]), /non-empty array/);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.populationVariance([3, 3, 3, 3]), 0);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.populationVariance([42]), 0);
		});
	});

	describe("groupByDate", () => {
		it("should group by month", () => {
			const data = [
				{ date: "2024-01-15", value: 1 },
				{ date: "2024-01-20", value: 2 },
				{ date: "2024-02-10", value: 3 },
			];
			const result = stats.groupByDate(data, "date", "month");
			assert.strictEqual(result.length, 2);
			const jan = result.find((g) => g.key.includes("Jan"));
			assert.strictEqual(jan.items.length, 2);
		});

		it("should group by quarter", () => {
			const data = [
				{ date: "2024-01-15", value: 1 },
				{ date: "2024-04-10", value: 2 },
				{ date: "2024-07-20", value: 3 },
			];
			const result = stats.groupByDate(data, "date", "quarter");
			assert.strictEqual(result.length, 3);
		});

		it("should group by year", () => {
			const data = [
				{ date: "2023-06-15", value: 1 },
				{ date: "2024-06-20", value: 2 },
			];
			const result = stats.groupByDate(data, "date", "year");
			assert.strictEqual(result.length, 2);
		});

		it("should handle Date objects", () => {
			const data = [
				{ date: new Date("2024-01-15"), value: 1 },
				{ date: new Date("2024-02-10"), value: 2 },
			];
			const result = stats.groupByDate(data, "date", "month");
			assert.strictEqual(result.length, 2);
		});

		it("should skip invalid dates", () => {
			const data = [
				{ date: "not-a-date", value: 1 },
				{ date: "2024-01-15", value: 2 },
			];
			const result = stats.groupByDate(data, "date", "month");
			assert.strictEqual(result.length, 1);
		});

		it("should skip items with numeric dateField values", () => {
			const data = [
				{ date: 12345, value: 1 },
				{ date: "2024-01-15", value: 2 },
			];
			const result = stats.groupByDate(data, "date", "month");
			assert.strictEqual(result.length, 1);
		});

		it("should throw for empty data", () => {
			assert.throws(() => stats.groupByDate([], "date"), /non-empty array/);
		});

		it("should throw for invalid dateField", () => {
			assert.throws(
				() => stats.groupByDate([{ date: "2024-01-01" }], ""),
				/valid date field/,
			);
		});

		it("should throw for invalid range", () => {
			assert.throws(
				() => stats.groupByDate([{ date: "2024-01-01" }], "date", "week"),
				/month.*quarter.*year/,
			);
		});
	});

	describe("safeNumber", () => {
		it("should handle Date objects", () => {
			// safeNumber is not exported, but we can test via functions that use it
			const result = stats.mean([new Date("2024-01-01")]);
			assert.ok(typeof result === "number");
		});

		it("should handle null via mean", () => {
			// null → safeNumber returns 0, so mean([1, 0, 3]) = 4/3
			const result = stats.mean([1, null, 3]);
			assert.strictEqual(result, 4 / 3);
		});

		it("should handle undefined via mean", () => {
			const result = stats.mean([1, undefined, 3]);
			assert.strictEqual(result, 4 / 3);
		});

		it("should handle boolean via mean", () => {
			const result = stats.mean([1, true, 3]);
			assert.strictEqual(result, 4 / 3);
		});

		it("should handle object via mean", () => {
			const result = stats.mean([1, { a: 1 }, 3]);
			assert.strictEqual(result, 4 / 3);
		});
	});
});
