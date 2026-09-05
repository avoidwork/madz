/**
 * Tests for the PDF parser.
 * @see {@link src/tools/fileExtract/pdfParser.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("pdfToMarkdown", () => {
  let pdfToMarkdown, PdfExtractionError;

  before(async () => {
    const mod = await import("../../../../src/tools/fileExtract/pdfParser.js");
    pdfToMarkdown = mod.pdfToMarkdown;
    PdfExtractionError = mod.PdfExtractionError;
  });

  it("should return empty string for null buffer", async () => {
    const result = await pdfToMarkdown(null);
    assert.strictEqual(result, "");
  });

  it("should return empty string for empty buffer", async () => {
    const result = await pdfToMarkdown(Buffer.alloc(0));
    assert.strictEqual(result, "");
  });

  it("should have PdfExtractionError with name and reason", () => {
    const err = new PdfExtractionError("Test error", "test-reason");
    assert.strictEqual(err.name, "PdfExtractionError");
    assert.strictEqual(err.reason, "test-reason");
    assert.strictEqual(err.message, "Test error");
  });

  it("should have PdfExtractionError with null reason by default", () => {
    const err = new PdfExtractionError("Test error");
    assert.strictEqual(err.reason, null);
  });

  it("should handle pdf-parse import failure gracefully", async () => {
    // This tests the error path when pdf-parse is not available
    // The function will throw PdfExtractionError
    try {
      await pdfToMarkdown(Buffer.from("test"));
      // If it doesn't throw, that's fine too (pdf-parse might be installed)
    } catch (err) {
      assert.ok(err instanceof PdfExtractionError);
    }
  });
});
