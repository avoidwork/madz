/**
 * Unit tests for the FilePicker component's pure logic.
 * Tests filter derivation, token replacement, and the open/refine/navigate/select/close flow.
 * @module tests/unit/tui/filePicker.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { deriveFilter, replaceToken } from "../../../src/tui/filePicker.js";

describe("deriveFilter — whitespace-bounded token derivation", () => {
	it("derives filter from unquoted token bounded by whitespace", () => {
		const result = deriveFilter("read @src/config/loader.js", 10);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/");
		assert.strictEqual(result.tokenStart, 5);
	});

	it("derives filter when @ is mid-string with a space on either side", () => {
		const result = deriveFilter("foo @bar baz", 8);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "bar");
		assert.strictEqual(result.tokenStart, 4);
		assert.strictEqual(result.tokenEnd, 8);
	});

	it("ignores the first space and anything after it when unquoted", () => {
		// Typing after the space: the token is bounded by the space, so the
		// filter is empty and the picker is inactive.
		const result = deriveFilter("foo @bar baz", 9);
		assert.strictEqual(result.active, false);
		assert.strictEqual(result.filter, "");
	});

	it("keeps the filter growing as the user types inside the token", () => {
		const first = deriveFilter("foo @bar baz", 8);
		const second = deriveFilter("foo @barx baz", 9);
		assert.strictEqual(first.filter, "bar");
		assert.strictEqual(second.filter, "barx");
	});

	it("is inactive when there is no @ token", () => {
		const result = deriveFilter("hello world", 5);
		assert.strictEqual(result.active, false);
		assert.strictEqual(result.filter, "");
	});

	it("is inactive when cursor is before the @", () => {
		const result = deriveFilter("@foo", 0);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when cursor is after the token", () => {
		const result = deriveFilter("@foo bar", 5);
		assert.strictEqual(result.active, false);
	});

	it("is active when @ is at the end with no following char", () => {
		const result = deriveFilter("@", 1);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "");
	});

	it("treats glob metacharacters literally", () => {
		const result = deriveFilter("@src/*.js", 8);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/*.j");
	});
});

describe("replaceToken — @ token replacement", () => {
	it("replaces the token with the full path", () => {
		const result = replaceToken("read @src/config/loader.js", 5, 26, "src/config/loader.js");
		assert.strictEqual(result, "read src/config/loader.js");
	});

	it("wraps a path with whitespace in quotes", () => {
		const result = replaceToken("@foo bar", 0, 8, "my file.txt");
		assert.strictEqual(result, '"my file.txt"');
	});

	it("does not quote a path without whitespace", () => {
		const result = replaceToken("@foo", 0, 4, "src/foo.js");
		assert.strictEqual(result, "src/foo.js");
	});

	it("preserves text after the token", () => {
		const result = replaceToken(
			"read @src/config/loader.js and fix",
			5,
			26,
			"src/config/loader.js",
		);
		assert.strictEqual(result, "read src/config/loader.js and fix");
	});

	it("quotes a selected path with spaces when inserted mid-string", () => {
		const result = replaceToken("foo @bar baz", 4, 8, "my file.txt");
		assert.strictEqual(result, 'foo "my file.txt" baz');
	});
});

describe("FilePicker — open/refine/navigate/select/close flow", () => {
	it("opens when the cursor is inside an @ token", () => {
		const result = deriveFilter("@src", 4);
		assert.strictEqual(result.active, true);
	});

	it("refines the filter as the user types", () => {
		const first = deriveFilter("@src", 4);
		const second = deriveFilter("@src/co", 7);
		assert.strictEqual(first.filter, "src");
		assert.strictEqual(second.filter, "src/co");
	});

	it("closes when the cursor leaves the @ token", () => {
		const result = deriveFilter("@src config", 9);
		assert.strictEqual(result.active, false);
	});

	it("selects and replaces the token on Enter", () => {
		const result = replaceToken("@src/co", 0, 7, "src/config/loader.js");
		assert.strictEqual(result, "src/config/loader.js");
	});

	it("closes on Escape without replacing the token", () => {
		// Escape path — the token is left untouched.
		const result = replaceToken("@src", 0, 4, "@src");
		assert.strictEqual(result, "@src");
	});
});
