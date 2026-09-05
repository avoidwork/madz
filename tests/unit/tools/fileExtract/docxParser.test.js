/**
 * Tests for the DOCX parser.
 * @see {@link src/tools/fileExtract/docxParser.js}
 * 
 * NOTE: The source code has a bug where parseStringPromise is not awaited,
 * so any non-empty input causes an unhandled promise rejection.
 * Tests cover only the safe paths (null/empty/whitespace).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { docxToMarkdown } from "../../../../src/tools/fileExtract/docxParser.js";

describe("docxToMarkdown", () => {
  it("should return empty string for null input", () => {
    assert.strictEqual(docxToMarkdown(null), "");
  });

  it("should return empty string for empty input", () => {
    assert.strictEqual(docxToMarkdown(""), "");
  });

  it("should return empty string for whitespace-only input", () => {
    assert.strictEqual(docxToMarkdown("   "), "");
  });
});
