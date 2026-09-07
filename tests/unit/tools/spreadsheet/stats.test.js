/**
 * Tests for statistical operations.
 * @see {@link src/tools/spreadsheet/stats.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	mean,
	median,
	mode,
	stddev,
	populationStddev,
	variance,
	populationVariance,
	percentile,
	groupByDate,
} from "../../../../src/tools/spreadsheet/stats.js";

describe("mean", () => {
	it("should throw for empty array", () => {
		assert.throws(() => mean([]), /non-empty array/);
	});

	it("should throw for null", () => {
		assert.throws(() => mean(null), /non-empty array/);
	});

	it("should calculate mean of numbers", () => {
		assert.strictEqual(mean([1, 2, 3, 4, 5]), 3);
	});

	it("should handle string numbers", () => {
		assert.strictEqual(mean(["1", "2", "3"]), 2);
	});

	it("should return 0 for all NaN values", () => {
		assert.strictEqual(mean([NaN, NaN]), 0);
	});

	it("should filter out NaN values", () => {
		assert.strictEqual(mean([1, NaN, 3]), 2);
	});
});

describe("median", () => {
	it("should throw for empty array", () => {
		assert.throws(() => median([]), /non-empty array/);
	});

	it("should calculate median for odd count", () => {
		assert.strictEqual(median([1, 3, 2]), 2);
	});

	it("should calculate median for even count", () => {
		assert.strictEqual(median([1, 2, 3, 4]), 2.5);
	});

	it("should return 0 for all NaN values", () => {
		assert.strictEqual(median([NaN, NaN]), 0);
	});

	it("should sort numbers", () => {
		assert.strictEqual(median([5, 1, 3]), 3);
	});
});

describe("mode", () => {
	it("should return [] for empty array", () => {
		assert.deepStrictEqual(mode([]), []);
	});

	it("should return [] for null", () => {
		assert.deepStrictEqual(mode(null), []);
	});

	it("should return [] when all values unique", () => {
		assert.deepStrictEqual(mode([1, 2, 3]), []);
	});

	it("should find single mode", () => {
		assert.deepStrictEqual(mode([1, 2, 2, 3]), [2]);
	});

	it("should find multiple modes", () => {
		const result = mode([1, 1, 2, 2, 3]);
		assert.deepStrictEqual(result.sort(), [1, 2]);
	});

	it("should preserve numeric type", () => {
		const result = mode(["1", "1", "2"]);
		assert.strictEqual(typeof result[0], "number");
	});

	it("should handle string modes", () => {
		assert.deepStrictEqual(mode(["a", "a", "b"]), ["a"]);
	});
});

describe("stddev", () => {
	it("should throw for empty array", () => {
		assert.throws(() => stddev([]), /at least 2/);
	});

	it("should throw for single element", () => {
		assert.throws(() => stddev([1]), /at least 2/);
	});

	it("should calculate sample standard deviation", () => {
		const result = stddev([1, 2, 3, 4, 5]);
		assert.ok(Math.abs(result - 1.5811) < 0.001);
	});

	it("should throw if all values are NaN", () => {
		assert.throws(() => stddev([NaN, NaN]), /at least 2/);
	});
});

describe("populationStddev", () => {
	it("should throw for empty array", () => {
		assert.throws(() => populationStddev([]), /non-empty array/);
	});

	it("should calculate population standard deviation", () => {
		const result = populationStddev([1, 2, 3, 4, 5]);
		assert.ok(Math.abs(result - 1.4142) < 0.001);
	});

	it("should return 0 for all NaN values", () => {
		assert.strictEqual(populationStddev([NaN, NaN]), 0);
	});
});

describe("variance", () => {
	it("should throw for empty array", () => {
		assert.throws(() => variance([]), /at least 2/);
	});

	it("should calculate sample variance", () => {
		const result = variance([1, 2, 3, 4, 5]);
		assert.strictEqual(result, 2.5);
	});
});

describe("populationVariance", () => {
	it("should throw for empty array", () => {
		assert.throws(() => populationVariance([]), /non-empty array/);
	});

	it("should calculate population variance", () => {
		const result = populationVariance([1, 2, 3, 4, 5]);
		assert.strictEqual(result, 2);
	});
});

describe("percentile", () => {
	it("should throw for empty array", () => {
		assert.throws(() => percentile([], 50), /non-empty array/);
	});

	it("should throw for p < 0", () => {
		assert.throws(() => percentile([1, 2, 3], -1), /between 0 and 100/);
	});

	it("should throw for p > 100", () => {
		assert.throws(() => percentile([1, 2, 3], 101), /between 0 and 100/);
	});

	it("should calculate median (50th percentile)", () => {
		assert.strictEqual(percentile([1, 2, 3, 4, 5], 50), 3);
	});

	it("should calculate 0th percentile", () => {
		assert.strictEqual(percentile([1, 2, 3], 0), 1);
	});

	it("should calculate 100th percentile", () => {
		assert.strictEqual(percentile([1, 2, 3], 100), 3);
	});

	it("should return 0 for all NaN values", () => {
		assert.strictEqual(percentile([NaN, NaN], 50), 0);
	});

	it("should return single value for single element", () => {
		assert.strictEqual(percentile([42], 50), 42);
	});

	it("should use linear interpolation", () => {
		const result = percentile([1, 2, 3, 4], 25);
		assert.strictEqual(result, 1.75);
	});
});

describe("groupByDate", () => {
	const data = [
		{ date: "2024-01-15", val: 1 },
		{ date: "2024-02-20", val: 2 },
		{ date: "2024-04-10", val: 3 },
		{ date: "2025-01-05", val: 4 },
	];

	it("should throw for empty array", () => {
		assert.throws(() => groupByDate([], "date"), /non-empty array/);
	});

	it("should throw for null", () => {
		assert.throws(() => groupByDate(null, "date"), /non-empty array/);
	});

	it("should throw for invalid dateField", () => {
		assert.throws(() => groupByDate(data, ""), /valid date field/);
	});

	it("should throw for invalid range", () => {
		assert.throws(() => groupByDate(data, "date", "invalid"), /must be/);
	});

	it("should group by month", () => {
		const result = groupByDate(data, "date", "month");
		assert.strictEqual(result.length, 4);
		assert.ok(result.some((g) => g.key === "Jan 2024"));
	});

	it("should group by quarter", () => {
		const result = groupByDate(data, "date", "quarter");
		assert.strictEqual(result.length, 3);
		assert.ok(result.some((g) => g.key === "2024-Q1"));
	});

	it("should group by year", () => {
		const result = groupByDate(data, "date", "year");
		assert.strictEqual(result.length, 2);
		assert.ok(result.some((g) => g.key === "2024"));
	});

	it("should handle Date objects", () => {
		const dateData = [{ d: new Date("2024-06-15"), val: 1 }];
		const result = groupByDate(dateData, "d", "month");
		assert.strictEqual(result[0].key, "Jun 2024");
	});

	it("should skip invalid dates", () => {
		const badData = [
			{ date: "not-a-date", val: 1 },
			{ date: "2024-01-15", val: 2 },
		];
		const result = groupByDate(badData, "date", "month");
		assert.strictEqual(result.length, 1);
	});

	it("should skip items without date field", () => {
		const badData = [{ val: 1 }, { date: "2024-01-15", val: 2 }];
		const result = groupByDate(badData, "date", "month");
		assert.strictEqual(result.length, 1);
	});
});
