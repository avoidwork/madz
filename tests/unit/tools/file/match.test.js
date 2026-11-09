import { describe, it } from "node:test";
import assert from "node:assert";
import {
	buildWhitespaceRegex,
	escapeRegExp,
	fuzzyMatch,
	levenshteinDistance,
	lineNumberAt,
	suggestSimilarLines,
} from "../../../../src/tools/file/match.js";

/**
 * Apply the first match the way editImpl does, to prove offsets are exact.
 * @param {string} target - Text to find
 * @param {string} content - File text
 * @param {string} replacement - Replacement text
 * @returns {string} Resulting text
 */
function applyFirst(target, content, replacement) {
	const m = fuzzyMatch(target, content).find((r) => r.found);
	return content.slice(0, m.start) + replacement + content.slice(m.end);
}

describe("file/match - fuzzyMatch", () => {
	it("finds every exact occurrence", () => {
		const r = fuzzyMatch("ab", "ab-ab-ab");
		assert.strictEqual(r.length, 3);
		assert.deepStrictEqual(
			r.map((m) => m.start),
			[0, 3, 6],
		);
		assert.ok(r.every((m) => m.tier === "exact" && m.matched === "ab"));
	});

	it("returns not-found for empty or non-string targets", () => {
		assert.deepStrictEqual(fuzzyMatch("", "abc"), [{ found: false }]);
		assert.deepStrictEqual(fuzzyMatch(undefined, "abc"), [{ found: false }]);
	});

	it("does not match case-insensitively", () => {
		assert.deepStrictEqual(fuzzyMatch("const foo", "const Foo = 1"), [{ found: false }]);
	});

	it("does not join text across extra blank lines", () => {
		assert.deepStrictEqual(fuzzyMatch("line one line two", "line one\n\n\nline two"), [
			{ found: false },
		]);
		assert.deepStrictEqual(fuzzyMatch("a\nb", "a\n\nb"), [{ found: false }]);
	});

	it("tolerates indentation drift with exact offsets", () => {
		const content = "if (x) {\n    a();\n    b();\n}\n";
		assert.strictEqual(
			applyFirst("  a();\n  b();", content, "REPLACED"),
			"if (x) {\nREPLACED\n}\n",
		);
	});

	it("tolerates tabs versus spaces without corrupting neighbours", () => {
		const content = "\t\tkeep();\n\t\ttarget();\n\t\tafter();\n";
		assert.strictEqual(
			applyFirst("        target();", content, "NEW();"),
			"\t\tkeep();\nNEW();\n\t\tafter();\n",
		);
	});

	it("tolerates trailing whitespace in the file", () => {
		assert.strictEqual(applyFirst("a();\nb();", "a();   \nb();\n", "X"), "X\n");
	});

	it("tolerates CRLF files when the target uses LF", () => {
		assert.strictEqual(applyFirst("a\nb", "a\r\nb\r\nc\r\n", "Z"), "Z\r\nc\r\n");
	});

	it("tolerates collapsed internal spacing", () => {
		const r = fuzzyMatch("hello world", "hello   world");
		assert.strictEqual(r[0].tier, "whitespace");
		assert.strictEqual(r[0].matched, "hello   world");
	});

	it("reports every fuzzy match so ambiguity is visible", () => {
		assert.strictEqual(fuzzyMatch("a b", "a  b\na   b").length, 2);
	});

	it("does not treat regex metacharacters in the target as patterns", () => {
		assert.strictEqual(
			fuzzyMatch("a.c", "abc").some((m) => m.found),
			false,
		);
		assert.strictEqual(fuzzyMatch("f(x)  +", "f(x) +")[0].found, true);
	});

	it("refuses whitespace-only and oversized fuzzy targets", () => {
		assert.deepStrictEqual(fuzzyMatch("   ", "a b"), [{ found: false }]);
		assert.deepStrictEqual(fuzzyMatch("x ".repeat(30_000), "y"), [{ found: false }]);
	});
});

describe("file/match - helpers", () => {
	it("buildWhitespaceRegex is global and anchored to the line-break count", () => {
		const re = buildWhitespaceRegex("a\nb");
		assert.ok(re.global);
		assert.ok(re.test("a\r\nb"));
		assert.ok(!new RegExp(re.source).test("a\n\nb"));
	});

	it("escapeRegExp escapes metacharacters", () => {
		assert.strictEqual(escapeRegExp("a.b*c"), "a\\.b\\*c");
	});

	it("levenshteinDistance computes edit distance", () => {
		assert.strictEqual(levenshteinDistance("kitten", "sitting"), 3);
		assert.strictEqual(levenshteinDistance("same", "same"), 0);
		assert.strictEqual(levenshteinDistance("", "abc"), 3);
		assert.strictEqual(levenshteinDistance("abc", ""), 3);
	});

	it("lineNumberAt returns 1-based line numbers", () => {
		assert.strictEqual(lineNumberAt("a\nb\nc", 0), 1);
		assert.strictEqual(lineNumberAt("a\nb\nc", 2), 2);
		assert.strictEqual(lineNumberAt("a\nb\nc", 4), 3);
	});

	it("suggestSimilarLines returns numbered near-misses", () => {
		const out = suggestSimilarLines(
			"const value = 1;",
			"x\nconst valu = 1;\nzzzzzzzzzzzzzzzzzzzzzzzz",
		);
		assert.deepStrictEqual(out, ["2: const valu = 1;"]);
		assert.deepStrictEqual(suggestSimilarLines("   \n", "abc"), []);
	});
});
