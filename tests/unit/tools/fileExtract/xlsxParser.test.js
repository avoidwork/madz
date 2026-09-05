/**
 * Tests for the XLSX to Markdown parser.
 * @see {@link src/tools/fileExtract/xlsxParser.js}
 * 
 * NOTE: The source code has a bug where parseStringPromise is not awaited,
 * so any non-empty input causes an unhandled promise rejection.
 * Tests cover only the safe paths (empty map, null).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { xlsxToMarkdown } from "../../../../src/tools/fileExtract/xlsxParser.js";

describe("xlsxToMarkdown", () => {
  it("should return empty string for empty zip content", () => {
    const result = xlsxToMarkdown(new Map());
    assert.strictEqual(result, "");
  });

  it("should throw on null input (calls .get() on null)", () => {
    assert.throws(() => xlsxToMarkdown(null), TypeError);
  });
});
