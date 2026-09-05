import { describe, it } from "node:test";
import assert from "node:assert";
import { parseSizeString } from "../../../src/tools/common.js";

describe("parseSizeString", () => {
	it("parses bytes", () => {
		assert.strictEqual(parseSizeString("500b"), 500);
	});

	it("parses kilobytes", () => {
		assert.strictEqual(parseSizeString("1kb"), 1024);
	});

	it("parses megabytes", () => {
		assert.strictEqual(parseSizeString("1mb"), 1024 * 1024);
	});

	it("parses gigabytes", () => {
		assert.strictEqual(parseSizeString("1gb"), 1024 * 1024 * 1024);
	});

	it("parses decimal values", () => {
		assert.strictEqual(parseSizeString("1.5mb"), Math.floor(1.5 * 1024 * 1024));
	});

	it("defaults to 1mb for invalid strings", () => {
		assert.strictEqual(parseSizeString("invalid"), 1024 * 1024);
	});

	it("handles whitespace around value", () => {
		assert.strictEqual(parseSizeString("  2mb  "), 2 * 1024 * 1024);
	});

	it("handles uppercase units", () => {
		assert.strictEqual(parseSizeString("2MB"), 2 * 1024 * 1024);
	});

	it("defaults to bytes when no unit given", () => {
		assert.strictEqual(parseSizeString("100"), 100);
	});
});
