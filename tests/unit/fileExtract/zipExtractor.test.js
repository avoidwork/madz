/**
 * Unit tests for the file extraction utility module.
 * @module tests/unit/fileExtract/zipExtractor.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	extractZipXml,
	getZipFileNames,
	validateZip,
} from "../../../src/tools/fileExtract/zipExtractor.js";

describe("fileExtract/zipExtractor", () => {
	describe("validateZip", () => {
		it("should return valid for a supported ZIP-based format", async () => {
			const result = validateZip("test.docx");
			assert.strictEqual(result.valid, true);
		});

		it("should return invalid for unsupported formats", async () => {
			const result = validateZip("test.txt");
			assert.strictEqual(result.valid, false);
		});

		it("should return invalid for files without extension", async () => {
			const result = validateZip("test");
			assert.strictEqual(result.valid, false);
		});
	});

	describe("getZipFileNames", () => {
		it("should return an empty array when no ZIP file is provided", async () => {
			const result = await getZipFileNames(null);
			assert.deepStrictEqual(result, []);
		});

		it("should return an empty array for non-ZIP files", async () => {
			const result = await getZipFileNames("test.txt");
			assert.deepStrictEqual(result, []);
		});
	});

	describe("extractZipXml", () => {
		it("should throw an error for non-ZIP files", async () => {
			await assert.rejects(extractZipXml("test.txt"), { name: "ZipExtractionError" });
		});
	});
});
