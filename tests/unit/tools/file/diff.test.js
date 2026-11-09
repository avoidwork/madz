import { describe, it } from "node:test";
import assert from "node:assert";
import { generateUnifiedDiff } from "../../../../src/tools/file/diff.js";

describe("file/diff - generateUnifiedDiff", () => {
	it("produces headers and a minimal hunk for a one-line change", () => {
		const diff = generateUnifiedDiff("a\nb\nc", "a\nX\nc").split("\n");
		assert.deepStrictEqual(diff, [
			"--- a/file",
			"+++ b/file",
			"@@ -1,3 +1,3 @@",
			" a",
			"-b",
			"+X",
			" c",
		]);
	});

	it("shows an insertion as a pure addition, not a rewrite", () => {
		const diff = generateUnifiedDiff("a\nb", "N\na\nb").split("\n");
		assert.deepStrictEqual(diff.slice(2), ["@@ -1,2 +1,3 @@", "+N", " a", " b"]);
	});

	it("shows a deletion as a pure removal", () => {
		const diff = generateUnifiedDiff("a\nb\nc", "a\nc").split("\n");
		assert.deepStrictEqual(diff.slice(2), ["@@ -1,3 +1,2 @@", " a", "-b", " c"]);
	});

	it("returns only headers when nothing changed", () => {
		assert.strictEqual(generateUnifiedDiff("same\n", "same\n"), "--- a/file\n+++ b/file");
	});

	it("uses the label and omits headers on request", () => {
		assert.match(
			generateUnifiedDiff("a", "b", { label: "x.js" }),
			/^--- a\/x\.js\n\+\+\+ b\/x\.js/,
		);
		assert.ok(!generateUnifiedDiff("a", "b", { headers: false }).startsWith("---"));
	});

	it("offsets hunk line numbers by startLine", () => {
		const diff = generateUnifiedDiff("old", "new", { startLine: 40, headers: false });
		assert.strictEqual(diff.split("\n")[0], "@@ -40,1 +40,1 @@");
	});

	it("splits distant changes into separate hunks", () => {
		const oldText = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
		const newText = oldText.replace("l2", "L2").replace("l27", "L27");
		const hunks = generateUnifiedDiff(oldText, newText)
			.split("\n")
			.filter((l) => l.startsWith("@@"));
		assert.strictEqual(hunks.length, 2);
	});

	it("handles empty input on either side", () => {
		assert.match(generateUnifiedDiff("", "a\nb"), /@@ -0,0 \+1,2 @@/);
		assert.match(generateUnifiedDiff("a\nb", ""), /@@ -1,2 \+0,0 @@/);
	});

	it("falls back to a replace block for very large differing regions", () => {
		const a = Array.from({ length: 2500 }, (_, i) => `a${i}`).join("\n");
		const b = Array.from({ length: 2500 }, (_, i) => `b${i}`).join("\n");
		const diff = generateUnifiedDiff(a, b).split("\n");
		assert.strictEqual(diff.filter((l) => l.startsWith("-a")).length, 2500);
		assert.strictEqual(diff.filter((l) => l.startsWith("+b")).length, 2500);
	});
});
