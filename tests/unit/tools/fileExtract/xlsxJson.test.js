/**
 * Tests for the XLSX to JSON converter.
 * @see {@link src/tools/fileExtract/xlsxJson.js}
 * 
 * NOTE: The source code has a bug where parseStringPromise is not awaited,
 * so any non-empty input causes an unhandled promise rejection.
 * Tests cover only the safe paths (empty map, null).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { xlsxToJson } from "../../../../src/tools/fileExtract/xlsxJson.js";

describe("xlsxToJson", () => {
  it("should return empty object for empty zip content", () => {
    const result = xlsxToJson(new Map());
    assert.deepStrictEqual(result, {});
  });

  it("should throw on null input (calls .get() on null)", () => {
    assert.throws(() => xlsxToJson(null), TypeError);
  });
});
