/**
 * Tests for the spreadsheet pivot table module.
 * @see {@link src/tools/spreadsheet/pivot.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as pivot from "../../../../src/tools/spreadsheet/pivot.js";

describe("pivot", () => {
	describe("pivot", () => {
		it("should create a pivot table with sum aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
				{ region: "South", product: "B", sales: 250 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 2);
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["sum(sales)"], 300);
		});

		it("should create a pivot table with count aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: 200 },
				{ region: "South", sales: 150 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "count",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["count(sales)"], 2);
		});

		it("should create a pivot table with average aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: 200 },
				{ region: "South", sales: 300 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "avg",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["avg(sales)"], 150);
		});

		it("should throw for empty data", () => {
			assert.throws(
				() => pivot.pivot([], { keys: ["region"], value: "sales", aggregate: "sum" }),
				/requires a non-empty array/,
			);
		});
	});

	describe("filter", () => {
		it("should filter data by field equality", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = pivot.filter(data, "region", "eq", "North");
			assert.strictEqual(result.length, 2);
		});

		it("should filter data by field greater than", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 300 },
			];
			const result = pivot.filter(data, "sales", "gt", 150);
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].sales, 200);
		});

		it("should filter data by field less than", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 300 },
			];
			const result = pivot.filter(data, "sales", "lt", 250);
			assert.strictEqual(result.length, 2);
		});

		it("should return empty array when no matches", () => {
			const data = [{ region: "North", sales: 100 }];
			const result = pivot.filter(data, "region", "eq", "South");
			assert.strictEqual(result.length, 0);
		});

		it("should throw for empty data", () => {
			assert.throws(
				() => pivot.filter([], "region", "eq", "North"),
				/requires a non-empty array/,
			);
		});
	});

	describe("groupBy", () => {
		it("should group data by a single key", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = pivot.groupBy(data, ["region"]);
			assert.strictEqual(result.length, 2);
			const north = result.find((g) => g.key === "North");
			assert.strictEqual(north.items.length, 2);
		});

		it("should group data by multiple keys", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
			];
			const result = pivot.groupBy(data, ["region", "product"]);
			assert.strictEqual(result.length, 3);
		});

		it("should throw for empty data", () => {
			assert.throws(
				() => pivot.groupBy([], ["region"]),
				/requires a non-empty array/,
			);
		});

		it("should throw for non-string key", () => {
			assert.throws(
				() => pivot.groupBy([{ a: 1 }], [123]),
				/key must be a string/,
			);
		});

		it("should handle null values in grouped keys", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: null, sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = pivot.groupBy(data, ["region"]);
			assert.strictEqual(result.length, 2);
		});
	});

	describe("pivotMulti", () => {
		it("should create a multi-dimensional pivot table", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
				{ region: "South", product: "B", sales: 250 },
			];
			const result = pivot.pivotMulti(data, {
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

		it("should handle missing column keys", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north.Unknown, 200);
		});

		it("should throw for empty data", () => {
			assert.throws(
				() => pivot.pivotMulti([], { rowKey: "r", colKey: "c", value: "v", aggregate: "sum" }),
				/requires a non-empty array/,
			);
		});

		it("should throw for missing config", () => {
			assert.throws(
				() => pivot.pivotMulti([{ a: 1 }], {}),
				/requires rowKey/,
			);
		});

		it("should handle count aggregate", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
				{ region: "South", product: "B", sales: 300 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "count",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north.A, 2);
		});

		it("should handle min aggregate", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 50 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "min",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north.A, 50);
		});

		it("should handle max aggregate", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "max",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north.A, 200);
		});

		it("should handle avg aggregate", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "avg",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north.A, 150);
		});
	});

	describe("filter", () => {
		it("should filter data by field equality", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = pivot.filter(data, "region", "eq", "North");
			assert.strictEqual(result.length, 2);
		});

		it("should filter data by field greater than", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 300 },
			];
			const result = pivot.filter(data, "sales", "gt", 150);
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].sales, 200);
		});

		it("should filter data by field less than", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 300 },
			];
			const result = pivot.filter(data, "sales", "lt", 250);
			assert.strictEqual(result.length, 2);
		});

		it("should return empty array when no matches", () => {
			const data = [{ region: "North", sales: 100 }];
			const result = pivot.filter(data, "region", "eq", "South");
			assert.strictEqual(result.length, 0);
		});

		it("should throw for empty data", () => {
			assert.throws(
				() => pivot.filter([], "region", "eq", "North"),
				/requires a non-empty array/,
			);
		});

		it("should throw for missing field", () => {
			assert.throws(
				() => pivot.filter([{ a: 1 }], "", "eq", "x"),
				/requires field/,
			);
		});

		it("should throw for missing operator", () => {
			assert.throws(
				() => pivot.filter([{ a: 1 }], "a", ""),
				/requires field and operator/,
			);
		});

		it("should throw for invalid operator", () => {
			assert.throws(
				() => pivot.filter([{ a: 1 }], "a", "invalid", "x"),
				/must be one of/,
			);
		});

		it("should filter by contains", () => {
			const data = [{ name: "Alice" }, { name: "Bob" }, { name: "Alice Jr" }];
			const result = pivot.filter(data, "name", "contains", "Alice");
			assert.strictEqual(result.length, 2);
		});

		it("should filter by in array", () => {
			const data = [{ region: "North" }, { region: "South" }, { region: "East" }];
			const result = pivot.filter(data, "region", "in", ["North", "East"]);
			assert.strictEqual(result.length, 2);
		});

		it("should filter by gte", () => {
			const data = [{ val: 10 }, { val: 20 }, { val: 30 }];
			const result = pivot.filter(data, "val", "gte", 20);
			assert.strictEqual(result.length, 2);
		});

		it("should filter by lte", () => {
			const data = [{ val: 10 }, { val: 20 }, { val: 30 }];
			const result = pivot.filter(data, "val", "lte", 20);
			assert.strictEqual(result.length, 2);
		});

		it("should filter by neq", () => {
			const data = [{ region: "North" }, { region: "South" }, { region: "North" }];
			const result = pivot.filter(data, "region", "neq", "North");
			assert.strictEqual(result.length, 1);
		});
	});
});
