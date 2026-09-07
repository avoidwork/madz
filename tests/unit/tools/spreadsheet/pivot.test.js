/**
 * Tests for pivot table operations.
 * @see {@link src/tools/spreadsheet/pivot.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { groupBy, pivot, filter, pivotMulti } from "../../../../src/tools/spreadsheet/pivot.js";

const data = [
	{ region: "North", product: "A", sales: 100 },
	{ region: "North", product: "B", sales: 200 },
	{ region: "South", product: "A", sales: 150 },
	{ region: "South", product: "B", sales: 250 },
];

describe("groupBy", () => {
	it("should throw for empty array", () => {
		assert.throws(() => groupBy([], "region"), /non-empty array/);
	});

	it("should throw for null", () => {
		assert.throws(() => groupBy(null, "region"), /non-empty array/);
	});

	it("should throw for non-string key", () => {
		assert.throws(() => groupBy(data, 42), /key must be a string/);
	});

	it("should group by single key", () => {
		const result = groupBy(data, "region");
		assert.strictEqual(result.length, 2);
		const north = result.find((g) => g.key === "North");
		assert.strictEqual(north.items.length, 2);
	});

	it("should group by multiple keys", () => {
		const result = groupBy(data, ["region", "product"]);
		assert.strictEqual(result.length, 4);
	});

	it("should handle missing keys with empty string", () => {
		const result = groupBy([{ a: 1 }, { b: 2 }], "a");
		assert.strictEqual(result.length, 2);
	});
});

describe("pivot", () => {
	it("should throw for empty array", () => {
		assert.throws(
			() => pivot([], { keys: "region", value: "sales", aggregate: "sum" }),
			/non-empty array/,
		);
	});

	it("should throw for missing config", () => {
		assert.throws(() => pivot(data, {}), /requires keys, value, and aggregate/);
	});

	it("should throw for invalid aggregate", () => {
		assert.throws(
			() => pivot(data, { keys: "region", value: "sales", aggregate: "invalid" }),
			/aggregate must be/,
		);
	});

	it("should compute sum aggregation", () => {
		const result = pivot(data, { keys: "region", value: "sales", aggregate: "sum" });
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north["sum(sales)"], 300);
	});

	it("should compute count aggregation", () => {
		const result = pivot(data, { keys: "region", value: "sales", aggregate: "count" });
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north["count(sales)"], 2);
	});

	it("should compute avg aggregation", () => {
		const result = pivot(data, { keys: "region", value: "sales", aggregate: "avg" });
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north["avg(sales)"], 150);
	});

	it("should compute min aggregation", () => {
		const result = pivot(data, { keys: "region", value: "sales", aggregate: "min" });
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north["min(sales)"], 100);
	});

	it("should compute max aggregation", () => {
		const result = pivot(data, { keys: "region", value: "sales", aggregate: "max" });
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north["max(sales)"], 200);
	});

	it("should use custom label", () => {
		const result = pivot(data, {
			keys: "region",
			value: "sales",
			aggregate: "sum",
			label: "Total",
		});
		assert.ok(result[0].Total !== undefined);
	});

	it("should handle multiple keys", () => {
		const result = pivot(data, { keys: ["region", "product"], value: "sales", aggregate: "sum" });
		assert.strictEqual(result.length, 4);
	});

	it("should handle null/undefined values", () => {
		const dirty = [
			{ region: "N", sales: null },
			{ region: "N", sales: undefined },
			{ region: "N", sales: 100 },
		];
		const result = pivot(dirty, { keys: "region", value: "sales", aggregate: "sum" });
		assert.strictEqual(result[0]["sum(sales)"], 100);
	});

	it("should handle non-numeric values", () => {
		const dirty = [
			{ region: "N", sales: "abc" },
			{ region: "N", sales: 100 },
		];
		const result = pivot(dirty, { keys: "region", value: "sales", aggregate: "sum" });
		assert.strictEqual(result[0]["sum(sales)"], 100);
	});
});

describe("filter", () => {
	it("should throw for empty array", () => {
		assert.throws(() => filter([], "region", "eq", "North"), /non-empty array/);
	});

	it("should throw for missing field", () => {
		assert.throws(() => filter(data, "", "eq", "North"), /requires field and operator/);
	});

	it("should throw for invalid operator", () => {
		assert.throws(() => filter(data, "region", "bad", "North"), /operator must be/);
	});

	it("should filter by eq", () => {
		const result = filter(data, "region", "eq", "North");
		assert.strictEqual(result.length, 2);
	});

	it("should filter by neq", () => {
		const result = filter(data, "region", "neq", "North");
		assert.strictEqual(result.length, 2);
	});

	it("should filter by gt", () => {
		const result = filter(data, "sales", "gt", 150);
		assert.strictEqual(result.length, 2);
	});

	it("should filter by gte", () => {
		const result = filter(data, "sales", "gte", 200);
		assert.strictEqual(result.length, 2);
	});

	it("should filter by lt", () => {
		const result = filter(data, "sales", "lt", 200);
		assert.strictEqual(result.length, 2);
	});

	it("should filter by lte", () => {
		const result = filter(data, "sales", "lte", 100);
		assert.strictEqual(result.length, 1);
	});

	it("should filter by contains", () => {
		const result = filter(data, "region", "contains", "orth");
		assert.strictEqual(result.length, 2);
	});

	it("should filter by in", () => {
		const result = filter(data, "region", "in", ["North", "East"]);
		assert.strictEqual(result.length, 2);
	});
});

describe("pivotMulti", () => {
	it("should throw for empty array", () => {
		assert.throws(
			() =>
				pivotMulti([], { rowKey: "region", colKey: "product", value: "sales", aggregate: "sum" }),
			/non-empty array/,
		);
	});

	it("should throw for missing config", () => {
		assert.throws(() => pivotMulti(data, {}), /requires rowKey, colKey, value, and aggregate/);
	});

	it("should create multi-dimensional pivot", () => {
		const result = pivotMulti(data, {
			rowKey: "region",
			colKey: "product",
			value: "sales",
			aggregate: "sum",
		});
		assert.strictEqual(result.length, 2);
		const north = result.find((r) => r.region === "North");
		assert.strictEqual(north.A, 100);
		assert.strictEqual(north.B, 200);
	});

	it("should handle missing values with 0", () => {
		const sparse = [
			{ region: "N", product: "A", sales: 100 },
			{ region: "S", product: "B", sales: 200 },
		];
		const result = pivotMulti(sparse, {
			rowKey: "region",
			colKey: "product",
			value: "sales",
			aggregate: "sum",
		});
		const n = result.find((r) => r.region === "N");
		assert.strictEqual(n.B, 0);
	});

	it("should handle unknown keys", () => {
		const result = pivotMulti(data, {
			rowKey: "region",
			colKey: "product",
			value: "sales",
			aggregate: "sum",
		});
		assert.ok(result.length > 0);
	});
});
