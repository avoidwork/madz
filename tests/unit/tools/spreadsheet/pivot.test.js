/**
 * Tests for the spreadsheet pivot table module.
 * @see {@link src/tools/spreadsheet/pivot.js}
 */

import { describe, it, expect } from "node:test";
import assert from "node:assert";
import * as pivot from "../../../src/tools/spreadsheet/pivot.js";

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
        aggregation: "sum",
      });
      assert.strictEqual(result.length, 2);
      const north = result.find((r) => r.region === "North");
      assert.strictEqual(north.sales, 300);
    });

    it("should create a pivot table with count aggregation", () => {
      const data = [
        { region: "North", product: "A" },
        { region: "North", product: "B" },
        { region: "South", product: "A" },
      ];
      const result = pivot.pivot(data, {
        keys: ["region"],
        value: "product",
        aggregation: "count",
      });
      const north = result.find((r) => r.region === "North");
      assert.strictEqual(north.product, 2);
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
        aggregation: "avg",
      });
      const north = result.find((r) => r.region === "North");
      assert.strictEqual(north.sales, 150);
    });

    it("should handle empty data", () => {
      const result = pivot.pivot([], { keys: ["region"], value: "sales", aggregation: "sum" });
      assert.strictEqual(result.length, 0);
    });
  });

  describe("filter", () => {
    it("should filter data by field equality", () => {
      const data = [
        { region: "North", sales: 100 },
        { region: "South", sales: 200 },
        { region: "North", sales: 300 },
      ];
      const result = pivot.filter(data, "region", "==", "North");
      assert.strictEqual(result.length, 2);
    });

    it("should filter data by field greater than", () => {
      const data = [
        { region: "North", sales: 100 },
        { region: "South", sales: 200 },
        { region: "East", sales: 300 },
      ];
      const result = pivot.filter(data, "sales", ">", 150);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].sales, 300);
    });

    it("should filter data by field less than", () => {
      const data = [
        { region: "North", sales: 100 },
        { region: "South", sales: 200 },
        { region: "East", sales: 300 },
      ];
      const result = pivot.filter(data, "sales", "<", 250);
      assert.strictEqual(result.length, 2);
    });

    it("should return empty array when no matches", () => {
      const data = [{ region: "North", sales: 100 }];
      const result = pivot.filter(data, "region", "==", "South");
      assert.strictEqual(result.length, 0);
    });

    it("should handle empty data", () => {
      const result = pivot.filter([], "region", "==", "North");
      assert.strictEqual(result.length, 0);
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

    it("should handle empty data", () => {
      const result = pivot.groupBy([], ["region"]);
      assert.strictEqual(result.length, 0);
    });
  });
});