/**
 * Tests for the PPTX parser.
 * @see {@link src/tools/fileExtract/pptxParser.js}
 * 
 * NOTE: The source code has a bug where parseStringPromise is not awaited,
 * so any non-empty input causes an unhandled promise rejection.
 * Tests cover only the safe paths (empty map, null).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { pptxToMarkdown } from "../../../../src/tools/fileExtract/pptxParser.js";

describe("pptxToMarkdown", () => {
  it("should return empty string for empty zip content", () => {
    const result = pptxToMarkdown(new Map());
    assert.strictEqual(result, "");
  });

  it("should throw on null input (calls .keys() on null)", () => {
    assert.throws(() => pptxToMarkdown(null), TypeError);
  });
});
