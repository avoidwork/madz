import { describe, it } from "node:test";
import assert from "node:assert";
import { parseMemoryLimit, clampMemory } from "../../src/config/schemas.js";

describe("parseMemoryLimit", () => {
	it("parses megabytes string", () => {
		assert.strictEqual(parseMemoryLimit("512m"), 512 * 1024 ** 2);
	});

	it("parses gigabytes string", () => {
		assert.strictEqual(parseMemoryLimit("2g"), 2 * 1024 ** 3);
	});

	it("parses kilobytes string", () => {
		assert.strictEqual(parseMemoryLimit("1024k"), 1024 * 1024);
	});

	it("parses with B suffix", () => {
		assert.strictEqual(parseMemoryLimit("512mb"), 512 * 1024 ** 2);
		assert.strictEqual(parseMemoryLimit("2gb"), 2 * 1024 ** 3);
	});

	it("parses plain number as bytes", () => {
		assert.strictEqual(parseMemoryLimit("1024"), 0);
	});

	it("returns 0 for invalid input", () => {
		assert.strictEqual(parseMemoryLimit("invalid"), 0);
		assert.strictEqual(parseMemoryLimit(""), 0);
	});

	it("returns 0 for non-string input", () => {
		assert.strictEqual(parseMemoryLimit(null), 0);
		assert.strictEqual(parseMemoryLimit(undefined), 0);
		assert.strictEqual(parseMemoryLimit(512), 0);
	});

	it("is case-insensitive", () => {
		assert.strictEqual(parseMemoryLimit("512MB"), 512 * 1024 ** 2);
		assert.strictEqual(parseMemoryLimit("2GB"), 2 * 1024 ** 3);
		assert.strictEqual(parseMemoryLimit("1024K"), 1024 * 1024);
	});
});

describe("clampMemory", () => {
	it("returns 0 for '0' string", () => {
		assert.strictEqual(clampMemory("0"), 0);
	});

	it("returns 0 for 'off' string", () => {
		assert.strictEqual(clampMemory("off"), 0);
	});

	it("returns 0 for '0 ' with whitespace", () => {
		assert.strictEqual(clampMemory(" 0 "), 0);
	});

	it("returns 0 for 'off' with whitespace", () => {
		assert.strictEqual(clampMemory("  off  "), 0);
	});

	it("returns default bytes for non-string input", () => {
		assert.strictEqual(clampMemory(null), 512 * 1024 ** 2);
		assert.strictEqual(clampMemory(undefined), 512 * 1024 ** 2);
	});

	it("parses valid memory limit", () => {
		const result = clampMemory("512m");
		assert.strictEqual(result, 512 * 1024 ** 2);
	});

	it("returns 0 for invalid string", () => {
		assert.strictEqual(clampMemory("invalid"), 0);
	});
});
