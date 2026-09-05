/**
 * Tests for the ZIP extractor.
 * @see {@link src/tools/fileExtract/zipExtractor.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { validateZip, ZipExtractionError } from "../../../../src/tools/fileExtract/zipExtractor.js";

describe("validateZip", () => {
  it("should return invalid for path with no extension", () => {
    const result = validateZip("/path/to/file");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes("No file extension"));
  });

  it("should return invalid for unsupported format", () => {
    const result = validateZip("/path/to/file.txt");
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes("Unsupported format"));
  });

  it("should return valid for .docx", () => {
    const result = validateZip("/path/to/file.docx");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "docx");
  });

  it("should return valid for .xlsx", () => {
    const result = validateZip("/path/to/file.xlsx");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "xlsx");
  });

  it("should return valid for .pptx", () => {
    const result = validateZip("/path/to/file.pptx");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "pptx");
  });

  it("should return valid for .odt", () => {
    const result = validateZip("/path/to/file.odt");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "odt");
  });

  it("should return valid for .ods", () => {
    const result = validateZip("/path/to/file.ods");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "ods");
  });

  it("should return valid for .odp", () => {
    const result = validateZip("/path/to/file.odp");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "odp");
  });

  it("should return valid for .epub", () => {
    const result = validateZip("/path/to/file.epub");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.format, "epub");
  });
});

describe("ZipExtractionError", () => {
  it("should create error with name and reason", () => {
    const err = new ZipExtractionError("Test error", "test-reason");
    assert.strictEqual(err.name, "ZipExtractionError");
    assert.strictEqual(err.reason, "test-reason");
    assert.strictEqual(err.message, "Test error");
  });

  it("should create error with null reason by default", () => {
    const err = new ZipExtractionError("Test error");
    assert.strictEqual(err.reason, null);
  });
});

describe("getZipFileNames", () => {
  let getZipFileNames;

  before(async () => {
    const mod = await import("../../../../src/tools/fileExtract/zipExtractor.js");
    getZipFileNames = mod.getZipFileNames;
  });

  it("should throw ZipExtractionError for non-existent file", async () => {
    try {
      await getZipFileNames("/tmp/nonexistent.zip");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ZipExtractionError);
    }
  });
});

describe("extractZipXml", () => {
  let extractZipXml;

  before(async () => {
    const mod = await import("../../../../src/tools/fileExtract/zipExtractor.js");
    extractZipXml = mod.extractZipXml;
  });

  it("should throw ZipExtractionError for non-existent file", async () => {
    try {
      await extractZipXml("/tmp/nonexistent.zip");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ZipExtractionError);
    }
  });
});

describe("extractZipFile", () => {
  let extractZipFile;

  before(async () => {
    const mod = await import("../../../../src/tools/fileExtract/zipExtractor.js");
    extractZipFile = mod.extractZipFile;
  });

  it("should throw ZipExtractionError for non-existent file", async () => {
    try {
      await extractZipFile("/tmp/nonexistent.zip", "word/document.xml");
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof ZipExtractionError);
    }
  });
});
