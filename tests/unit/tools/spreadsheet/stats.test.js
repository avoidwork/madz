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

		it("should throw on empty array", () => {
			assert.throws(() => stats.mean([]), /non-empty array/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.mean(null), /non-empty array/);
		});

		it("should throw on undefined", () => {
			assert.throws(() => stats.mean(undefined), /non-empty array/);
		});

		it("should throw on non-array", () => {
			assert.throws(() => stats.mean("string"), /non-empty array/);
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

		it("should handle string numbers", () => {
			assert.strictEqual(stats.mean(["1", "2", "3"]), 2);
		});

		it("should handle mixed valid and invalid values", () => {
			// safeNumber("abc") returns 0, so mean = (1 + 0 + 3) / 3 = 1.333...
			assert.strictEqual(stats.mean([1, "abc", 3]), 4 / 3);
		});

		it("should return 0 for all non-numeric", () => {
			assert.strictEqual(stats.mean(["abc", "def"]), 0);
		});

		it("should handle Date objects", () => {
			const d = new Date("2024-01-15");
			const result = stats.mean([d]);
			assert.strictEqual(result, d.getTime());
		});

		it("should handle large numbers", () => {
			assert.strictEqual(stats.mean([1e10, 2e10]), 1.5e10);
		});

		it("should handle Infinity", () => {
			assert.strictEqual(stats.mean([Infinity, Infinity]), Infinity);
		});
	});

	describe("median", () => {
		it("should calculate the median of an odd-length array", () => {
			assert.strictEqual(stats.median([1, 3, 5]), 3);
		});

		it("should calculate the median of an even-length array", () => {
			assert.strictEqual(stats.median([1, 3, 5, 7]), 4);
		});

		it("should throw on empty array", () => {
			assert.throws(() => stats.median([]), /non-empty array/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.median(null), /non-empty array/);
		});

		it("should handle unsorted input", () => {
			assert.strictEqual(stats.median([5, 1, 3]), 3);
		});

		it("should handle negative numbers", () => {
			assert.strictEqual(stats.median([-5, -1, -3]), -3);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.median([42]), 42);
		});

		it("should handle two values", () => {
			assert.strictEqual(stats.median([1, 3]), 2);
		});

		it("should handle string numbers", () => {
			assert.strictEqual(stats.median(["1", "3", "5"]), 3);
		});

		it("should return 0 for all non-numeric", () => {
			assert.strictEqual(stats.median(["abc", "def"]), 0);
		});

		it("should handle large even-length array", () => {
			const arr = Array.from({ length: 1000 }, (_, i) => i);
			assert.strictEqual(stats.median(arr), 499.5);
		});

		it("should handle large odd-length array", () => {
			const arr = Array.from({ length: 999 }, (_, i) => i);
			assert.strictEqual(stats.median(arr), 499);
		});

		it("should handle duplicate values", () => {
			assert.strictEqual(stats.median([1, 1, 1, 2, 3]), 1);
		});

		it("should handle all identical values", () => {
			assert.strictEqual(stats.median([5, 5, 5, 5]), 5);
		});
	});

	describe("mode", () => {
		it("should return the most frequent value", () => {
			assert.deepStrictEqual(stats.mode([1, 2, 2, 3, 3, 3, 4]), [3]);
		});

		it("should return multiple modes for multimodal arrays", () => {
			const result = stats.mode([1, 1, 2, 2]);
			assert.deepStrictEqual(result, [1, 2]);
		});

		it("should return empty array for empty input", () => {
			assert.deepStrictEqual(stats.mode([]), []);
		});

		it("should return empty array for null", () => {
			assert.deepStrictEqual(stats.mode(null), []);
		});

		it("should return empty array for undefined", () => {
			assert.deepStrictEqual(stats.mode(undefined), []);
		});

		it("should handle single value", () => {
			assert.deepStrictEqual(stats.mode([42]), []);
		});

		it("should handle all unique values", () => {
			assert.deepStrictEqual(stats.mode([1, 2, 3, 4]), []);
		});

		it("should handle string values", () => {
			const result = stats.mode(["a", "b", "b", "c"]);
			assert.deepStrictEqual(result, ["b"]);
		});

		it("should handle mixed types", () => {
			const result = stats.mode([1, "1", 1]);
			assert.deepStrictEqual(result, [1]);
		});

		it("should handle boolean values (converted to string key)", () => {
			const result = stats.mode([true, true, false]);
			// mode() converts values to strings internally, so true becomes "true" string
			assert.deepStrictEqual(result, ["true"]);
		});

		it("should handle null values in array (converted to string key)", () => {
			const result = stats.mode([null, null, 1]);
			// mode() converts values to strings internally, so null becomes "null" string
			assert.deepStrictEqual(result, ["null"]);
		});

		it("should handle undefined values in array (converted to string key)", () => {
			const result = stats.mode([undefined, undefined, 1]);
			// mode() converts values to strings internally, so undefined becomes "undefined" string
			assert.deepStrictEqual(result, ["undefined"]);
		});

		it("should handle all same values", () => {
			assert.deepStrictEqual(stats.mode([7, 7, 7, 7]), [7]);
		});

		it("should handle frequency of 1 returning empty", () => {
			assert.deepStrictEqual(stats.mode([1, 2, 3]), []);
		});
	});

	describe("stddev", () => {
		it("should calculate the standard deviation", () => {
			const result = stats.stddev([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 2.138) < 0.01);
		});

		it("should throw on single value", () => {
			assert.throws(() => stats.stddev([5]), /at least 2/);
		});

		it("should throw on empty array", () => {
			assert.throws(() => stats.stddev([]), /at least 2/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.stddev(null), /at least 2/);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.stddev([3, 3, 3, 3]), 0);
		});

		it("should handle two values", () => {
			const result = stats.stddev([1, 3]);
			assert.ok(Math.abs(result - 1.414) < 0.01);
		});

		it("should handle string numbers", () => {
			const result = stats.stddev(["2", "4", "4", "4", "5", "5", "7", "9"]);
			assert.ok(Math.abs(result - 2.138) < 0.01);
		});

		it("should throw when filtered to less than 2 numbers", () => {
			// NaN values are filtered out, leaving fewer than 2 numbers
			assert.throws(() => stats.stddev([NaN, NaN]), /at least 2/);
		});

		it("should handle large values", () => {
			const result = stats.stddev([1000000, 1000001, 1000002]);
			assert.ok(Math.abs(result - 1.0) < 0.01);
		});

		it("should handle negative values", () => {
			const result = stats.stddev([-5, -3, -1]);
			assert.ok(Math.abs(result - 2.0) < 0.01);
		});

		it("should handle mixed string and number", () => {
			const result = stats.stddev([1, "2", 3]);
			assert.ok(Math.abs(result - 1.0) < 0.01);
		});
	});

	describe("populationStddev", () => {
		it("should calculate population standard deviation", () => {
			const result = stats.populationStddev([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 2.0) < 0.01);
		});

		it("should throw on empty array", () => {
			assert.throws(() => stats.populationStddev([]), /non-empty array/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.populationStddev(null), /non-empty array/);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.populationStddev([5]), 0);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.populationStddev([3, 3, 3, 3]), 0);
		});

		it("should return 0 for all non-numeric", () => {
			assert.strictEqual(stats.populationStddev(["abc", "def"]), 0);
		});

		it("should handle two values", () => {
			const result = stats.populationStddev([1, 3]);
			assert.strictEqual(result, 1);
		});

		it("should handle string numbers", () => {
			const result = stats.populationStddev(["2", "4"]);
			assert.strictEqual(result, 1);
		});
	});

	describe("variance", () => {
		it("should calculate the variance", () => {
			const result = stats.variance([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 4.571) < 0.01);
		});

		it("should throw on single value", () => {
			assert.throws(() => stats.variance([5]), /at least 2/);
		});

		it("should throw on empty array", () => {
			assert.throws(() => stats.variance([]), /at least 2/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.variance(null), /at least 2/);
		});

		it("should handle two values", () => {
			assert.strictEqual(stats.variance([1, 3]), 2);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.variance([3, 3, 3, 3]), 0);
		});

		it("should throw when filtered to less than 2 numbers", () => {
			// NaN values are filtered out, leaving fewer than 2 numbers
			assert.throws(() => stats.variance([NaN, NaN]), /at least 2/);
		});

		it("should handle large values", () => {
			const result = stats.variance([1000000, 1000001, 1000002]);
			assert.ok(Math.abs(result - 1.0) < 0.01);
		});

		it("should handle negative values", () => {
			const result = stats.variance([-5, -3, -1]);
			assert.strictEqual(result, 4);
		});
	});

	describe("populationVariance", () => {
		it("should calculate population variance", () => {
			const result = stats.populationVariance([2, 4, 4, 4, 5, 5, 7, 9]);
			assert.ok(Math.abs(result - 4.0) < 0.01);
		});

		it("should throw on empty array", () => {
			assert.throws(() => stats.populationVariance([]), /non-empty array/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.populationVariance(null), /non-empty array/);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.populationVariance([5]), 0);
		});

		it("should handle identical values", () => {
			assert.strictEqual(stats.populationVariance([3, 3, 3, 3]), 0);
		});

		it("should return 0 for all non-numeric", () => {
			assert.strictEqual(stats.populationVariance(["abc", "def"]), 0);
		});

		it("should handle two values", () => {
			assert.strictEqual(stats.populationVariance([1, 3]), 1);
		});

		it("should handle string numbers", () => {
			assert.strictEqual(stats.populationVariance(["2", "4"]), 1);
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

		it("should throw on empty array", () => {
			assert.throws(() => stats.percentile([], 50), /non-empty array/);
		});

		it("should throw on null", () => {
			assert.throws(() => stats.percentile(null, 50), /non-empty array/);
		});

		it("should throw on p < 0", () => {
			assert.throws(() => stats.percentile([1, 2, 3], -1), /p between 0 and 100/);
		});

		it("should throw on p > 100", () => {
			assert.throws(() => stats.percentile([1, 2, 3], 101), /p between 0 and 100/);
		});

		it("should handle percentile interpolation", () => {
			const result = stats.percentile([1, 2, 3, 4], 25);
			assert.ok(result > 1.5 && result < 2);
		});

		it("should handle single value", () => {
			assert.strictEqual(stats.percentile([42], 50), 42);
		});

		it("should handle two values", () => {
			assert.strictEqual(stats.percentile([1, 3], 50), 2);
		});

		it("should handle string numbers", () => {
			assert.strictEqual(stats.percentile(["1", "2", "3", "4", "5"], 50), 3);
		});

		it("should return 0 for all non-numeric", () => {
			assert.strictEqual(stats.percentile(["abc", "def"], 50), 0);
		});

		it("should handle 25th percentile exactly", () => {
			const result = stats.percentile([1, 2, 3, 4], 25);
			// index = 0.25 * 3 = 0.75, lower=0, upper=1, fraction=0.75
			// = 1 + 0.75 * (2-1) = 1.75
			assert.strictEqual(result, 1.75);
		});

		it("should handle 75th percentile exactly", () => {
			const result = stats.percentile([1, 2, 3, 4], 75);
			// index = 0.75 * 3 = 2.25, lower=2, upper=3, fraction=0.25
			// = 3 + 0.25 * (4-3) = 3.25
			assert.strictEqual(result, 3.25);
		});

		it("should handle large array", () => {
			const arr = Array.from({ length: 1001 }, (_, i) => i);
			assert.strictEqual(stats.percentile(arr, 50), 500);
		});
	});

	describe("groupByDate", () => {
		const data = [
			{ date: "2024-01-15", sales: 100 },
			{ date: "2024-02-20", sales: 200 },
			{ date: "2024-04-10", sales: 150 },
			{ date: "2024-07-05", sales: 300 },
			{ date: "2025-01-10", sales: 400 },
		];

		it("should group by month", () => {
			const result = stats.groupByDate(data, "date", "month");
			assert.strictEqual(result.length, 5);
			assert.ok(result.some((g) => g.key === "Jan 2024"));
		});

		it("should group by quarter", () => {
			const result = stats.groupByDate(data, "date", "quarter");
			assert.strictEqual(result.length, 4);
			assert.ok(result.some((g) => g.key === "2024-Q1"));
		});

		it("should group by year", () => {
			const result = stats.groupByDate(data, "date", "year");
			assert.strictEqual(result.length, 2);
			assert.ok(result.some((g) => g.key === "2024"));
		});

		it("should throw on empty data", () => {
			assert.throws(() => stats.groupByDate([], "date"), /non-empty array/);
		});

		it("should throw on null data", () => {
			assert.throws(() => stats.groupByDate(null, "date"), /non-empty array/);
		});

		it("should throw on missing dateField", () => {
			assert.throws(() => stats.groupByDate(data, ""), /valid date field name/);
		});

		it("should throw on invalid range", () => {
			assert.throws(() => stats.groupByDate(data, "date", "invalid"), /range must be/);
		});

		it("should handle Date objects", () => {
			const dateData = [
				{ date: new Date("2024-01-15"), sales: 100 },
				{ date: new Date("2024-01-20"), sales: 200 },
			];
			const result = stats.groupByDate(dateData, "date", "month");
			assert.strictEqual(result.length, 1);
		});

		it("should skip invalid dates", () => {
			const badData = [
				{ date: "2024-01-15", sales: 100 },
				{ date: "not-a-date", sales: 200 },
				{ date: null, sales: 300 },
			];
			const result = stats.groupByDate(badData, "date", "month");
			assert.strictEqual(result.length, 1);
		});

		it("should default to month range", () => {
			const result = stats.groupByDate(data, "date");
			assert.ok(result.length > 0);
		});

		it("should handle non-string, non-Date values by skipping", () => {
			const badData = [
				{ date: "2024-01-15", sales: 100 },
				{ date: 12345, sales: 200 }, // number, not string or Date
			];
			const result = stats.groupByDate(badData, "date", "month");
			assert.strictEqual(result.length, 1);
		});

		it("should group multiple items in same month", () => {
			const monthData = [
				{ date: "2024-01-15", sales: 100 },
				{ date: "2024-01-20", sales: 200 },
				{ date: "2024-02-10", sales: 150 },
			];
			const result = stats.groupByDate(monthData, "date", "month");
			const janGroup = result.find((g) => g.key === "Jan 2024");
			assert.strictEqual(janGroup.items.length, 2);
		});

		it("should group by quarter correctly", () => {
			const quarterData = [
				{ date: "2024-01-15", sales: 100 },
				{ date: "2024-03-20", sales: 200 },
				{ date: "2024-04-10", sales: 150 },
				{ date: "2024-07-05", sales: 300 },
			];
			const result = stats.groupByDate(quarterData, "date", "quarter");
			assert.strictEqual(result.length, 3);
			assert.ok(result.some((g) => g.key === "2024-Q1"));
			assert.ok(result.some((g) => g.key === "2024-Q2"));
			assert.ok(result.some((g) => g.key === "2024-Q3"));
		});

		it("should handle December dates correctly for quarter", () => {
			const decData = [
				{ date: "2024-12-15", sales: 100 },
			];
			const result = stats.groupByDate(decData, "date", "quarter");
			assert.strictEqual(result[0].key, "2024-Q4");
		});
	});
});
