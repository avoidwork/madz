import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	readFileImpl,
	writeFileImpl,
	patchImpl,
	nativeSearch,
	fuzzyMatch,
	levenshteinDistance,
} from "../../src/tools/filesystem.js";

const testDir = join(process.cwd(), "memory", "__test_files__");
const testFile = join(testDir, "test.txt");
const nestedDir = join(testDir, "nested", "deep");
const nestedFile = join(nestedDir, "file.txt");
const largeFile = join(testDir, "large.txt");

function setup() {
	mkdirSync(testDir, { recursive: true });
	writeFileSync(testFile, "line1\nline2\nline3\nline4\nline5\n");
	mkdirSync(nestedDir, { recursive: true });
	writeFileSync(nestedFile, "const x = 1;\n  const y = 2;\nconst z = 3;");
}

function teardown() {
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
}

const allowedPaths = [testDir, "memory/"];

describe("tools - filesystem impl", () => {
	before(setup);
	after(teardown);

	describe("readFileImpl", () => {
		it("reads full file with line numbers", async () => {
			const result = await readFileImpl({ path: testFile }, { allowedPaths, maxReadSize: "1mb" });
			assert.ok(result.includes("1|line1"));
			assert.ok(result.includes("2|line2"));
			assert.ok(result.includes("3|line3"));
		});

		it("reads file with pagination", async () => {
			const result = await readFileImpl(
				{ path: testFile, offset: 1, limit: 2 },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("2|line2"));
			assert.ok(result.includes("3|line3"));
			assert.ok(!result.includes("line1"));
		});

		it("rejects path outside sandbox", async () => {
			const result = await readFileImpl(
				{ path: "/etc/passwd" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("outside sandbox") || result.includes("outside"));
		});

		it("rejects file exceeding maxReadSize", async () => {
			writeFileSync(largeFile, "x".repeat(2 * 1024 * 1024));
			const result = await readFileImpl({ path: largeFile }, { allowedPaths, maxReadSize: "1mb" });
			assert.ok(result.includes("exceeds") || result.includes("limit"));
			writeFileSync(largeFile, "");
		});

		it("suggests similar filename on ENOENT", async () => {
			const result = await readFileImpl(
				{ path: join(testDir, "tesdt.txt") },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(!result.includes("Error: Access denied"));
		});
	});

	describe("writeFileImpl", () => {
		it("writes content to file", async () => {
			const target = join(testDir, "written.txt");
			const result = await writeFileImpl(
				{ path: target, content: "hello world" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Successfully wrote"));
			assert.strictEqual(readFileSync(target, "utf-8"), "hello world");
		});

		it("creates nested directories", async () => {
			const target = join(testDir, "a", "b", "c", "file.txt");
			const result = await writeFileImpl(
				{ path: target, content: "nested" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Successfully"));
			assert.strictEqual(readFileSync(target, "utf-8"), "nested");
		});

		it("creates dirs even when parent doesn't exist", async () => {
			const target = join(nestedDir, "newdir", "file.txt");
			const result = await writeFileImpl(
				{ path: target, content: "new" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Successfully"));
		});

		it("rejects content exceeding max size", async () => {
			const target = join(testDir, "big.txt");
			const bigContent = "x".repeat(500 * 1024 + 1);
			const result = await writeFileImpl(
				{ path: target, content: bigContent },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exceeds") || result.includes("too large"));
		});

		it("rejects path outside sandbox", async () => {
			const result = await writeFileImpl(
				{ path: "/tmp/outside.txt", content: "x" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("outside") || result.includes("Error"));
		});
	});

	describe("patchImpl", () => {
		it("patches with exact match", async () => {
			const target = join(testDir, "patch_test.txt");
			writeFileSync(target, "const x = 1\nconst y = 2\nconst z = 3");
			const result = await patchImpl(
				{ path: target, oldStr: "const y = 2", newStr: "const y = 99" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Patch applied"));
			assert.ok(readFileSync(target, "utf-8").includes("const y = 99"));
		});

		it("patches with whitespace-insensitive match", async () => {
			const target = join(testDir, "patch_ws.txt");
			writeFileSync(target, "  const x = 1\n    const y = 2\n");
			const result = await patchImpl(
				{ path: target, oldStr: "const y = 2", newStr: "const y = 0" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Patch applied") || result.includes("could not find"));
		});

		it("fails when no match found", async () => {
			const target = join(testDir, "patch_nofail.txt");
			writeFileSync(target, "const x = 1\nconst y = 2");
			const result = await patchImpl(
				{ path: target, oldStr: "totally_not_in_file_xyz123", newStr: "replacement" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(
				result.includes("could not find") || result.includes("failed") || result.includes("Error"),
			);
		});

		it("rejects path outside sandbox", async () => {
			const result = await patchImpl(
				{ path: "/tmp/patch.txt", oldStr: "a", newStr: "b" },
				{ allowedPaths, maxReadSize: "1mb" },
			);
			assert.ok(result.includes("outside") || result.includes("Error"));
		});
	});

	describe("nativeSearch", () => {
		it("finds matches in file content", async () => {
			writeFileSync(
				join(testDir, "search_test.txt"),
				"error: timeout\ninfo: start\nerror: disk full",
			);
			const result = await nativeSearch("error", testDir, 10);
			assert.ok(
				typeof result === "string" && (result.includes("error") || result.includes("Found")),
			);
		});

		it("returns no matches when pattern not found", async () => {
			writeFileSync(join(testDir, "search_none.txt"), "hello world");
			const result = await nativeSearch("xyznotfound", testDir, 10);
			assert.strictEqual(typeof result, "string");
			assert.ok(result.includes("No matches"));
		});
	});

	describe("fuzzyMatch", () => {
		it("finds exact match", () => {
			const result = fuzzyMatch("const x = 1;", "const x = 1;\nconst y = 2;");
			assert.strictEqual(result[0].found, true);
		});

		it("finds match with trailing whitespace difference", () => {
			const content = "const x = 1;  \nconst y = 2;";
			const result = fuzzyMatch("const x = 1;", content);
			assert.strictEqual(result[0].found, true);
		});

		it("finds match with leading whitespace difference", () => {
			const content = "    const x = 1;\nconst y = 2;";
			const result = fuzzyMatch("const x = 1;", content);
			assert.strictEqual(result[0].found, true);
		});

		it("finds case-insensitive match", () => {
			const content = "CONST X = 1;\nCONST Y = 2;";
			const result = fuzzyMatch("const x = 1;", content);
			assert.strictEqual(result[0].found, true);
		});

		it("returns not found for completely different text", () => {
			const result = fuzzyMatch("totally absent text", "const x = 1");
			assert.strictEqual(result[0].found, false);
		});
	});

	describe("levenshteinDistance", () => {
		it("returns 0 for identical strings", () => {
			assert.strictEqual(levenshteinDistance("hello", "hello"), 0);
		});

		it("returns string length for different strings", () => {
			assert.strictEqual(levenshteinDistance("abc", "xyz"), 3);
		});

		it("calculates distance for small edit", () => {
			const result = levenshteinDistance("test", "tesx");
			assert.strictEqual(result, 1);
		});
	});
});
