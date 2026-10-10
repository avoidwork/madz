/**
 * Tests for the messages module.
 * @see {@link src/tui/messages.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	getRoleLabel,
	normalizeCompletedToolCalls,
	hasCompletedToolCalls,
	formatCompletedToolCalls,
} from "../../../src/tui/messages.js";

describe("getRoleLabel", () => {
	it("returns 'You' for user role", () => {
		assert.strictEqual(getRoleLabel("user"), "You");
	});

	it("returns 'Assistant' for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant"), "Assistant");
	});

	it("returns custom name for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant", "Mads"), "Mads");
	});

	it("returns 'System' for system role", () => {
		assert.strictEqual(getRoleLabel("system"), "System");
	});

	it("returns role string for unknown role", () => {
		assert.strictEqual(getRoleLabel("tool"), "tool");
	});

	it("returns 'Unknown' for falsy role", () => {
		assert.strictEqual(getRoleLabel(""), "Unknown");
	});
});

describe("normalizeCompletedToolCalls", () => {
	it("returns empty object for falsy input", () => {
		assert.deepStrictEqual(normalizeCompletedToolCalls(), {});
		assert.deepStrictEqual(normalizeCompletedToolCalls(null), {});
		assert.deepStrictEqual(normalizeCompletedToolCalls(undefined), {});
	});

	it("collapses a legacy array into a count map", () => {
		assert.deepStrictEqual(normalizeCompletedToolCalls(["read_file", "read_file", "searchCode"]), {
			read_file: 2,
			searchCode: 1,
		});
	});

	it("returns a copy of an existing count map", () => {
		const input = { read_file: 2 };
		const result = normalizeCompletedToolCalls(input);
		assert.deepStrictEqual(result, { read_file: 2 });
		assert.notStrictEqual(result, input, "should not mutate the input");
	});

	it("does not mutate a legacy array input", () => {
		const input = ["read_file", "read_file"];
		normalizeCompletedToolCalls(input);
		assert.deepStrictEqual(input, ["read_file", "read_file"]);
	});
});

describe("hasCompletedToolCalls", () => {
	it("returns false for empty or falsy input", () => {
		assert.strictEqual(hasCompletedToolCalls(), false);
		assert.strictEqual(hasCompletedToolCalls([]), false);
		assert.strictEqual(hasCompletedToolCalls({}), false);
	});

	it("returns true for a non-empty array", () => {
		assert.strictEqual(hasCompletedToolCalls(["read_file"]), true);
	});

	it("returns true for a non-empty count map", () => {
		assert.strictEqual(hasCompletedToolCalls({ read_file: 2 }), true);
	});
});

describe("formatCompletedToolCalls", () => {
	it("returns zero total and empty text for no calls", () => {
		assert.deepStrictEqual(formatCompletedToolCalls(), { total: 0, text: "" });
		assert.deepStrictEqual(formatCompletedToolCalls({}), { total: 0, text: "" });
	});

	it("hides the count for tools called once", () => {
		assert.deepStrictEqual(formatCompletedToolCalls(["searchCode"]), {
			total: 1,
			text: "searchCode",
		});
	});

	it("shows the count for repeated tools", () => {
		assert.deepStrictEqual(formatCompletedToolCalls({ read_file: 10, searchCode: 1 }), {
			total: 11,
			text: "read_file ×10, searchCode",
		});
	});

	it("preserves insertion order", () => {
		assert.deepStrictEqual(formatCompletedToolCalls(["searchCode", "read_file", "read_file"]), {
			total: 3,
			text: "searchCode, read_file ×2",
		});
	});

	it("accepts a count map directly", () => {
		assert.deepStrictEqual(formatCompletedToolCalls({ read_file: 2 }), {
			total: 2,
			text: "read_file ×2",
		});
	});
});
