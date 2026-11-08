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
	coalesceSegments,
	hasId,
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

describe("coalesceSegments", () => {
	it("coalesces consecutive message chunks into one segment", () => {
		const result = coalesceSegments([{ type: "message", content: "Hello " }], {
			type: "message",
			content: "world",
		});
		assert.deepStrictEqual(result, [{ type: "message", content: "Hello world" }]);
	});

	it("starts a new message block when a reasoning segment interleaves", () => {
		const result = coalesceSegments(
			[
				{ type: "message", content: "The answer is " },
				{ type: "reasoning", content: "calculating..." },
			],
			{ type: "message", content: "42" },
		);
		assert.deepStrictEqual(result, [
			{ type: "message", content: "The answer is " },
			{ type: "reasoning", content: "calculating..." },
			{ type: "message", content: "42" },
		]);
	});

	it("coalesces message chunks that share an id into one block", () => {
		const result = coalesceSegments([{ type: "message", content: "Hello ", id: "0" }], {
			type: "message",
			content: "world",
			id: "0",
		});
		assert.deepStrictEqual(result, [{ type: "message", content: "Hello world", id: "0" }]);
	});

	it("starts a new message block when the id differs", () => {
		const result = coalesceSegments([{ type: "message", content: "first ", id: "0" }], {
			type: "message",
			content: "second",
			id: "1",
		});
		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].id, "0");
		assert.strictEqual(result[1].id, "1");
	});

	it("coalesces message chunks across an interleaved reasoning segment when ids match", () => {
		const result = coalesceSegments(
			[
				{ type: "message", content: "Hello ", id: "0" },
				{ type: "reasoning", content: "thinking..." },
			],
			{ type: "message", content: "world", id: "0" },
		);
		assert.deepStrictEqual(result, [
			{ type: "message", content: "Hello world", id: "0" },
			{ type: "reasoning", content: "thinking..." },
		]);
	});

	it("keeps each tool segment as its own block", () => {
		const result = coalesceSegments([{ type: "tool", content: "output one", name: "read_file" }], {
			type: "tool",
			content: "output two",
			name: "read_file",
		});
		assert.strictEqual(result.length, 2);
	});

	it("coalesces reasoning chunks that share an id into one block", () => {
		const result = coalesceSegments([{ type: "reasoning", content: "thinking ", id: "rs_1" }], {
			type: "reasoning",
			content: "hard",
			id: "rs_1",
		});
		assert.deepStrictEqual(result, [{ type: "reasoning", content: "thinking hard", id: "rs_1" }]);
	});

	it("starts a new reasoning block when the id differs", () => {
		const result = coalesceSegments([{ type: "reasoning", content: "first thought", id: "rs_1" }], {
			type: "reasoning",
			content: "second thought",
			id: "rs_2",
		});
		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].id, "rs_1");
		assert.strictEqual(result[1].id, "rs_2");
	});

	it("coalesces reasoning across an interleaved message when ids match", () => {
		const result = coalesceSegments(
			[
				{ type: "reasoning", content: "measured cad", id: "rs_1" },
				{ type: "message", content: "Yo," },
			],
			{ type: "reasoning", content: "ence.", id: "rs_1" },
		);
		assert.deepStrictEqual(result, [
			{ type: "reasoning", content: "measured cadence.", id: "rs_1" },
			{ type: "message", content: "Yo," },
		]);
	});

	it("does not coalesce reasoning chunks with different ids even across a sentence boundary", () => {
		const result = coalesceSegments(
			[{ type: "reasoning", content: "measured cadence.", id: "rs_1" }],
			{ type: "reasoning", content: "Jason", id: "rs_2" },
		);
		assert.strictEqual(result.length, 2);
	});

	it("starts a new reasoning block at a grammatical sentence boundary when no id is present", () => {
		const result = coalesceSegments([{ type: "reasoning", content: "First thought." }], {
			type: "reasoning",
			content: "Second thought",
		});
		assert.strictEqual(result.length, 2);
	});

	it("coalesces reasoning without an id when no sentence boundary is present", () => {
		const result = coalesceSegments([{ type: "reasoning", content: "thinking " }], {
			type: "reasoning",
			content: "hard",
		});
		assert.deepStrictEqual(result, [{ type: "reasoning", content: "thinking hard" }]);
	});
});

describe("hasId", () => {
	it("treats 0 as a present id", () => {
		assert.strictEqual(hasId(0), true);
	});

	it("treats nullish and empty-string ids as absent", () => {
		assert.strictEqual(hasId(undefined), false);
		assert.strictEqual(hasId(null), false);
		assert.strictEqual(hasId(""), false);
	});

	it("treats non-empty string and positive number ids as present", () => {
		assert.strictEqual(hasId("rs_1"), true);
		assert.strictEqual(hasId(3), true);
	});
});

describe("coalesceSegments with id 0", () => {
	it("coalesces message chunks that share id 0", () => {
		const a = coalesceSegments([], { type: "message", content: "Hel", id: 0 });
		const b = coalesceSegments(a, { type: "message", content: "lo", id: 0 });
		assert.strictEqual(b.length, 1);
		assert.strictEqual(b[0].content, "Hello");
	});

	it("starts a new message block when id 0 follows a different id", () => {
		const a = coalesceSegments([], { type: "message", content: "one", id: 1 });
		const b = coalesceSegments(a, { type: "message", content: "two", id: 0 });
		assert.strictEqual(b.length, 2);
	});

	it("coalesces reasoning chunks that share id 0 and skips the sentence-boundary split", () => {
		const a = coalesceSegments([], { type: "reasoning", content: "Done.", id: 0 });
		const b = coalesceSegments(a, { type: "reasoning", content: "Next", id: 0 });
		assert.strictEqual(b.length, 1);
		assert.strictEqual(b[0].content, "Done.Next");
	});
});
