/**
 * Tests for the spreadsheet pivot table module.
 * @see {@link src/tools/spreadsheet/pivot.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as pivot from "../../../../src/tools/spreadsheet/pivot.js";

describe("pivot", () => {
	describe("groupBy", () => {
		it("should group data by a single key", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "North", sales: 300 },
			];
			const result = pivot.groupBy(data, "region");
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

		it("should throw on empty data", () => {
			assert.throws(() => pivot.groupBy([], "region"), /non-empty array/);
		});

		it("should throw on null data", () => {
			assert.throws(() => pivot.groupBy(null, "region"), /non-empty array/);
		});

		it("should throw on undefined data", () => {
			assert.throws(() => pivot.groupBy(undefined, "region"), /non-empty array/);
		});

		it("should throw on non-string key", () => {
			const data = [{ region: "North" }];
			assert.throws(() => pivot.groupBy(data, 42), /key must be a string/);
		});

		it("should throw on non-string key in array", () => {
			const data = [{ region: "North" }];
			assert.throws(() => pivot.groupBy(data, ["region", 42]), /key must be a string/);
		});

		it("should handle missing key values with empty string", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ sales: 200 },
			];
			const result = pivot.groupBy(data, "region");
			assert.strictEqual(result.length, 2);
		});

		it("should handle single item group", () => {
			const data = [{ region: "North", sales: 100 }];
			const result = pivot.groupBy(data, "region");
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].items.length, 1);
		});

		it("should handle null key values", () => {
			const data = [
				{ region: null, sales: 100 },
				{ region: "North", sales: 200 },
			];
			const result = pivot.groupBy(data, "region");
			assert.strictEqual(result.length, 2);
			const nullGroup = result.find((g) => g.key === "");
			assert.ok(nullGroup);
		});

		it("should handle undefined key values", () => {
			const data = [
				{ region: undefined, sales: 100 },
				{ region: "North", sales: 200 },
			];
			const result = pivot.groupBy(data, "region");
			assert.strictEqual(result.length, 2);
		});

		it("should handle many groups", () => {
			const data = Array.from({ length: 100 }, (_, i) => ({ group: `g${i % 10}`, val: i }));
			const result = pivot.groupBy(data, "group");
			assert.strictEqual(result.length, 10);
		});
	});

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

		it("should create a pivot table with min aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: 200 },
				{ region: "South", sales: 300 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "min",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["min(sales)"], 100);
		});

		it("should create a pivot table with max aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: 200 },
				{ region: "South", sales: 300 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "max",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["max(sales)"], 200);
		});

		it("should use custom label", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "sum",
				label: "Total Sales",
			});
			assert.ok(result[0].hasOwnProperty("Total Sales"));
		});

		it("should handle multiple keys", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
				{ region: "South", product: "A", sales: 150 },
			];
			const result = pivot.pivot(data, {
				keys: ["region", "product"],
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 3);
		});

		it("should throw on empty data", () => {
			assert.throws(
				() => pivot.pivot([], { keys: ["region"], value: "sales", aggregate: "sum" }),
				/non-empty array/,
			);
		});

		it("should throw on missing config", () => {
			const data = [{ region: "North", sales: 100 }];
			assert.throws(() => pivot.pivot(data, null), /requires keys, value, and aggregate/);
		});

		it("should throw on missing keys", () => {
			const data = [{ region: "North", sales: 100 }];
			assert.throws(
				() => pivot.pivot(data, { value: "sales", aggregate: "sum" }),
				/requires keys, value, and aggregate/,
			);
		});

		it("should throw on missing value", () => {
			const data = [{ region: "North", sales: 100 }];
			assert.throws(
				() => pivot.pivot(data, { keys: ["region"], aggregate: "sum" }),
				/requires keys, value, and aggregate/,
			);
		});

		it("should throw on missing aggregate", () => {
			const data = [{ region: "North", sales: 100 }];
			assert.throws(
				() => pivot.pivot(data, { keys: ["region"], value: "sales" }),
				/requires keys, value, and aggregate/,
			);
		});

		it("should throw on invalid aggregate", () => {
			const data = [{ region: "North", sales: 100 }];
			assert.throws(
				() => pivot.pivot(data, { keys: ["region"], value: "sales", aggregate: "invalid" }),
				/aggregate must be one of/,
			);
		});

		it("should handle null/undefined values in aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: null },
				{ region: "North", sales: undefined },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result[0]["sum(sales)"], 100);
		});

		it("should handle non-numeric values in aggregation", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", sales: "abc" },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result[0]["sum(sales)"], 100);
		});

		it("should handle all non-numeric values", () => {
			const data = [
				{ region: "North", sales: "abc" },
				{ region: "North", sales: "def" },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result[0]["sum(sales)"], 0);
		});

		it("should handle single key as string not array", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
			];
			const result = pivot.pivot(data, {
				keys: "region",
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 2);
		});

		it("should handle empty group values returning 0 for all aggregates", () => {
			const data = [
				{ region: "North", sales: "abc" },
				{ region: "North", sales: "def" },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "avg",
			});
			assert.strictEqual(result[0]["avg(sales)"], 0);
		});

		it("should handle count with all NaN values", () => {
			const data = [
				{ region: "North", sales: "abc" },
				{ region: "North", sales: "def" },
			];
			const result = pivot.pivot(data, {
				keys: ["region"],
				value: "sales",
				aggregate: "count",
			});
			assert.strictEqual(result[0]["count(sales)"], 0);
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

		it("should throw on empty data", () => {
			assert.throws(() => pivot.filter([], "region", "eq", "North"), /non-empty array/);
		});

		it("should throw on null data", () => {
			assert.throws(() => pivot.filter(null, "region", "eq", "North"), /non-empty array/);
		});

		it("should throw on missing field", () => {
			const data = [{ region: "North" }];
			assert.throws(() => pivot.filter(data, "", "eq", "North"), /requires field and operator/);
		});

		it("should throw on missing operator", () => {
			const data = [{ region: "North" }];
			assert.throws(() => pivot.filter(data, "region", "", "North"), /requires field and operator/);
		});

		it("should throw on invalid operator", () => {
			const data = [{ region: "North" }];
			assert.throws(() => pivot.filter(data, "region", "invalid", "North"), /operator must be one of/);
		});

		it("should filter by neq", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
			];
			const result = pivot.filter(data, "region", "neq", "North");
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].region, "South");
		});

		it("should filter by gte", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 200 },
			];
			const result = pivot.filter(data, "sales", "gte", 200);
			assert.strictEqual(result.length, 2);
		});

		it("should filter by lte", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 200 },
			];
			const result = pivot.filter(data, "sales", "lte", 100);
			assert.strictEqual(result.length, 1);
		});

		it("should filter by contains", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "Northeast", sales: 300 },
			];
			const result = pivot.filter(data, "region", "contains", "North");
			assert.strictEqual(result.length, 2);
		});

		it("should filter by in", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "South", sales: 200 },
				{ region: "East", sales: 300 },
			];
			const result = pivot.filter(data, "region", "in", ["North", "East"]);
			assert.strictEqual(result.length, 2);
		});

		it("should filter by in with non-array value", () => {
			const data = [
				{ region: "North", sales: 100 },
			];
			const result = pivot.filter(data, "region", "in", "North");
			assert.strictEqual(result.length, 0);
		});

		it("should handle loose equality (eq) with different types", () => {
			const data = [
				{ region: "North", sales: "100" },
			];
			const result = pivot.filter(data, "sales", "eq", 100);
			assert.strictEqual(result.length, 1);
		});

		it("should handle loose inequality (neq) with different types", () => {
			const data = [
				{ region: "North", sales: "100" },
			];
			const result = pivot.filter(data, "sales", "neq", 200);
			assert.strictEqual(result.length, 1);
		});

		it("should filter by contains with non-string field", () => {
			const data = [
				{ region: "North", sales: 100 },
			];
			const result = pivot.filter(data, "sales", "contains", "10");
			assert.strictEqual(result.length, 1);
		});

		it("should filter by gte with string comparison", () => {
			const data = [
				{ region: "North", sales: "100" },
				{ region: "South", sales: "200" },
			];
			const result = pivot.filter(data, "sales", "gte", "150");
			assert.strictEqual(result.length, 1);
		});

		it("should filter by lte with string comparison", () => {
			const data = [
				{ region: "North", sales: "100" },
				{ region: "South", sales: "200" },
			];
			const result = pivot.filter(data, "sales", "lte", "150");
			assert.strictEqual(result.length, 1);
		});

		it("should handle missing field value gracefully", () => {
			const data = [
				{ region: "North" },
				{ region: "South", sales: 200 },
			];
			const result = pivot.filter(data, "sales", "eq", undefined);
			assert.strictEqual(result.length, 1); // North has undefined sales == undefined
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
			assert.strictEqual(north["A"], 100);
			assert.strictEqual(north["B"], 200);
		});

		it("should throw on empty data", () => {
			assert.throws(
				() => pivot.pivotMulti([], { rowKey: "region", colKey: "product", value: "sales", aggregate: "sum" }),
				/non-empty array/,
			);
		});

		it("should throw on missing config", () => {
			const data = [{ region: "North", product: "A", sales: 100 }];
			assert.throws(
				() => pivot.pivotMulti(data, { rowKey: "region", colKey: "product", value: "sales" }),
				/requires rowKey, colKey, value, and aggregate/,
			);
		});

		it("should handle missing values with 0", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "South", product: "B", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["B"], 0);
		});

		it("should handle count aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
				{ region: "South", product: "B", sales: 150 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "count",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["A"], 2);
		});

		it("should handle avg aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
				{ region: "South", product: "B", sales: 150 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "avg",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["A"], 150);
		});

		it("should handle min aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
				{ region: "South", product: "B", sales: 150 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "min",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["A"], 100);
		});

		it("should handle max aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: 200 },
				{ region: "South", product: "B", sales: 150 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "max",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["A"], 200);
		});

		it("should handle unknown column keys", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 1);
		});

		it("should handle missing row key values with 'Unknown'", () => {
			const data = [
				{ product: "A", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 2);
			const unknown = result.find((r) => r.region === "Unknown");
			assert.ok(unknown);
		});

		it("should handle missing col key values with 'Unknown'", () => {
			const data = [
				{ region: "North", sales: 100 },
				{ region: "North", product: "B", sales: 200 },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			assert.strictEqual(result.length, 1);
			const north = result.find((r) => r.region === "North");
			assert.ok(north);
		});

		it("should handle null/undefined values in aggregation", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: null },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			const north = result.find((r) => r.region === "North");
			assert.strictEqual(north["A"], 100);
		});

		it("should handle non-numeric values in aggregation (string concatenation)", () => {
			const data = [
				{ region: "North", product: "A", sales: 100 },
				{ region: "North", product: "A", sales: "abc" },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			const north = result.find((r) => r.region === "North");
			// computeAggregate does not filter NaN, so 100 + "abc" = "100abc"
			assert.strictEqual(north["A"], "100abc");
		});

		it("should handle all non-numeric values (string concatenation)", () => {
			const data = [
				{ region: "North", product: "A", sales: "abc" },
				{ region: "North", product: "A", sales: "def" },
			];
			const result = pivot.pivotMulti(data, {
				rowKey: "region",
				colKey: "product",
				value: "sales",
				aggregate: "sum",
			});
			const north = result.find((r) => r.region === "North");
			// 0 + "abc" + "def" = "0abcdef"
			assert.strictEqual(north["A"], "0abcdef");
		});
	});
});
