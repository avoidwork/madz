import { describe, it } from "node:test";
import assert from "node:assert";
import { deriveFilter, replaceToken, MAX_VISIBLE } from "../../../src/tui/filePicker.js";

describe("deriveFilter", () => {
	it("is active when cursor is within an @ token", () => {
		const result = deriveFilter("read @src/config", 11);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/c");
		assert.strictEqual(result.tokenStart, 5);
		assert.strictEqual(result.tokenEnd, 16);
	});

	it("is inactive when there is no @", () => {
		const result = deriveFilter("read src/config", 11);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when cursor is before the @", () => {
		const result = deriveFilter("read @src/config", 3);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when cursor is at the @ position", () => {
		const result = deriveFilter("read @src/config", 5);
		assert.strictEqual(result.active, false);
	});

	it("treats quoted tokens as a single unit", () => {
		const result = deriveFilter('read "@src/my file"', 18);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/my file");
		assert.strictEqual(result.tokenStart, 5);
		assert.strictEqual(result.tokenEnd, 19);
	});

	it("clamps cursor to value length", () => {
		const result = deriveFilter("read @src", 100);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src");
	});

	it("treats glob metacharacters literally", () => {
		const result = deriveFilter("read @src/*.js", 14);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/*.js");
	});
});

describe("replaceToken", () => {
	it("replaces the @ token with the selected path", () => {
		const result = replaceToken("read @src/config", 5, 16, "src/config/loader.js");
		assert.strictEqual(result, "read src/config/loader.js");
	});

	it("quotes paths containing whitespace", () => {
		const result = replaceToken('read "@src/my file"', 5, 19, "src/my file.txt");
		assert.strictEqual(result, 'read "src/my file.txt"');
	});

	it("does not quote paths without whitespace", () => {
		const result = replaceToken("read @src", 5, 9, "src/index.js");
		assert.strictEqual(result, "read src/index.js");
	});
});

describe("MAX_VISIBLE", () => {
	it("is 3", () => {
		assert.strictEqual(MAX_VISIBLE, 3);
	});
});
