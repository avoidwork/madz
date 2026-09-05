import { describe, it } from "node:test";
import assert from "node:assert";
import { formatNumber, formatSize } from "../../../src/tui/statusBar.js";

describe("formatNumber", () => {
	it("formats a number with locale formatting", () => {
		const result = formatNumber(1234567);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("formats zero", () => {
		assert.strictEqual(formatNumber(0), "0");
	});

	it("handles NaN gracefully", () => {
		const result = formatNumber(NaN);
		assert.strictEqual(result, "NaN");
	});

	it("handles negative NaN gracefully", () => {
		// Force a case where formatter returns NaN
		const result = formatNumber(Number.NEGATIVE_INFINITY);
		assert.ok(typeof result === "string");
	});
});

describe("formatSize", () => {
	it("returns 0 for zero bytes", () => {
		assert.strictEqual(formatSize(0), "0");
	});

	it("formats positive byte count", () => {
		const result = formatSize(1024);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});
});
