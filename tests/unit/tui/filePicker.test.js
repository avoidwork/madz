import { describe, it } from "node:test";
import assert from "node:assert";
import {
	deriveFilter,
	shouldOpenPicker,
	replaceToken,
	sortFiles,
	MAX_VISIBLE,
} from "../../../src/tui/filePicker.js";

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

	it("is inactive when @ is mid-string (git URL)", () => {
		const result = deriveFilter("git@github.com:owner/repo.git", 25);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when @ is not preceded by a space", () => {
		const result = deriveFilter("git@github.com", 12);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when @ is followed by a space", () => {
		const result = deriveFilter("read @ src", 7);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when @ is not at the end of input", () => {
		const result = deriveFilter("read @src/config", 3);
		assert.strictEqual(result.active, false);
	});

	it("is active when @ is at the start of the input", () => {
		const result = deriveFilter("@src/config", 8);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src/con");
		assert.strictEqual(result.tokenStart, 0);
		assert.strictEqual(result.tokenEnd, 11);
	});

	it("is inactive on a bare @", () => {
		const result = deriveFilter("@", 1);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when @ is followed by a space at the start", () => {
		const result = deriveFilter("@ src", 2);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when @ is preceded by a non-space whitespace", () => {
		const result = deriveFilter("read\t@src", 8);
		assert.strictEqual(result.active, false);
	});

	it("is active when the token is followed by whitespace", () => {
		const result = deriveFilter("read @src config", 9);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "src");
		assert.strictEqual(result.tokenStart, 5);
		assert.strictEqual(result.tokenEnd, 9);
	});

	it("is inactive when @ is mid-word (he@he)", () => {
		const result = deriveFilter("he@he", 5);
		assert.strictEqual(result.active, false);
	});

	it("is active when the token contains a hyphen in the middle", () => {
		const result = deriveFilter("read @my-config.js", 18);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "my-config.js");
	});

	it("is active when the token starts with a hyphenated filename", () => {
		const result = deriveFilter("@-config.js", 11);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "-config.js");
	});
});

describe("shouldOpenPicker", () => {
	it("opens on a valid @ token at a word boundary", () => {
		assert.strictEqual(shouldOpenPicker("read @src/config"), true);
	});

	it("opens on @ at the start of the input", () => {
		assert.strictEqual(shouldOpenPicker("@src/config"), true);
	});

	it("does not open on @ mid-word (he@he)", () => {
		assert.strictEqual(shouldOpenPicker("he@he"), false);
	});

	it("does not open on @ mid-string (git URL)", () => {
		assert.strictEqual(shouldOpenPicker("git@github.com:owner/repo.git"), false);
	});

	it("does not open on @ not preceded by a space", () => {
		assert.strictEqual(shouldOpenPicker("git@github.com"), false);
	});

	it("does not open on a bare @", () => {
		assert.strictEqual(shouldOpenPicker("@"), false);
	});

	it("does not open on @ followed by a space", () => {
		assert.strictEqual(shouldOpenPicker("read @ src"), false);
	});

	it("does not open when there is no @", () => {
		assert.strictEqual(shouldOpenPicker("read src/config"), false);
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
