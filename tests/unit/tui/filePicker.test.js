import { describe, it } from "node:test";
import assert from "node:assert";
import { deriveFilter, replaceToken, sortFiles, MAX_VISIBLE } from "../../../src/tui/filePicker.js";

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

	it("does not quote paths without whitespace", () => {
		const result = replaceToken("read @src", 5, 9, "src/index.js");
		assert.strictEqual(result, "read src/index.js");
	});
});

describe("sortFiles", () => {
	it("sorts by length (shortest first), then locale", () => {
		const result = sortFiles(["src/very-long.js", "src/a.js", "src/mid.js"]);
		assert.deepStrictEqual(result, ["src/a.js", "src/mid.js", "src/very-long.js"]);
	});

	it("uses locale collation as a tiebreaker for equal lengths", () => {
		const result = sortFiles(["src/z.js", "src/a.js", "src/m.js"]);
		assert.deepStrictEqual(result, ["src/a.js", "src/m.js", "src/z.js"]);
	});

	it("returns a new array without mutating the input", () => {
		const input = ["src/z.js", "src/a.js"];
		const result = sortFiles(input);
		assert.deepStrictEqual(result, ["src/a.js", "src/z.js"]);
		assert.deepStrictEqual(input, ["src/z.js", "src/a.js"]);
	});

	it("handles case and accents naturally as a tiebreaker", () => {
		const result = sortFiles(["src/é.js", "src/E.js", "src/a.js"]);
		assert.deepStrictEqual(result, ["src/a.js", "src/E.js", "src/é.js"]);
	});
});

describe("MAX_VISIBLE", () => {
	it("is 3", () => {
		assert.strictEqual(MAX_VISIBLE, 3);
	});
});
