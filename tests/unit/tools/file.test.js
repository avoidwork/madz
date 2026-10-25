import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	file,
	fileImpl,
	readImpl,
	writeImpl,
	editImpl,
	deleteImpl,
	searchImpl,
	lsImpl,
	globImpl,
	grepImpl,
	generateUnifiedDiff,
	fuzzyMatch,
	levenshteinDistance,
} from "../../../src/tools/file/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_file__");
const ALLOWED_PATHS = [TEST_DIR];

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

function getOptions() {
	return { allowedPaths: ALLOWED_PATHS, maxReadSize: "1mb" };
}

describe("tools - file", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	describe("schema validation", () => {
		it("accepts a valid read action", () => {
			const result = file.schema.safeParse({ action: "read", path: "/tmp/x" });
			assert.strictEqual(result.success, true);
		});

		it("rejects an unknown action", () => {
			const result = file.schema.safeParse({ action: "execute", path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a missing path", () => {
			const result = file.schema.safeParse({ action: "read" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a missing action", () => {
			const result = file.schema.safeParse({ path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("accepts all valid actions", () => {
			for (const action of ["read", "write", "edit", "delete", "search", "ls", "glob", "grep"]) {
				const result = file.schema.safeParse({ action, path: "/tmp/x" });
				assert.strictEqual(result.success, true, `action ${action} should be valid`);
			}
		});
	});

	describe("read action", () => {
		it("returns file content with line numbers", async () => {
			const filePath = join(TEST_DIR, "read.txt");
			writeFileSync(filePath, "line one\nline two\nline three\n");
			const result = await readImpl({ path: filePath }, getOptions());
			assert.match(result, /1\|line one/);
			assert.match(result, /2\|line two/);
			assert.match(result, /3\|line three/);
		});

		it("supports offset/limit pagination", async () => {
			const filePath = join(TEST_DIR, "pagination.txt");
			writeFileSync(filePath, "a\nb\nc\nd\ne\n");
			const result = await readImpl({ path: filePath, offset: 1, limit: 2 }, getOptions());
			assert.match(result, /2\|b/);
			assert.match(result, /3\|c/);
			assert.ok(!result.includes("1|a"));
		});

		it("returns an error for a missing file", async () => {
			const result = await readImpl({ path: join(TEST_DIR, "missing.txt") }, getOptions());
			assert.match(result, /File not found/);
		});
	});

	describe("path validation", () => {
		it("denies a path outside the sandbox allowlist", async () => {
			const result = await readImpl({ path: "/etc/passwd" }, getOptions());
			assert.match(result, /Access denied/);
		});

		it("denies a write outside the sandbox allowlist", async () => {
			const result = await writeImpl({ path: "/etc/passwd", content: "x" }, getOptions());
			assert.match(result, /Access denied/);
		});

		it("allows a path inside the sandbox allowlist", async () => {
			const filePath = join(TEST_DIR, "allowed.txt");
			const result = await writeImpl({ path: filePath, content: "hello" }, getOptions());
			assert.match(result, /Successfully wrote/);
		});
	});

	describe("size-limit enforcement", () => {
		it("rejects a file exceeding the max read size", async () => {
			const filePath = join(TEST_DIR, "large.txt");
			writeFileSync(filePath, "x".repeat(2000));
			const result = await readImpl(
				{ path: filePath },
				{ allowedPaths: ALLOWED_PATHS, maxReadSize: "1kb" },
			);
			assert.match(result, /exceeds max read size/);
		});

		it("reads a file within the max read size", async () => {
			const filePath = join(TEST_DIR, "small.txt");
			writeFileSync(filePath, "small");
			const result = await readImpl(
				{ path: filePath },
				{ allowedPaths: ALLOWED_PATHS, maxReadSize: "1kb" },
			);
			assert.match(result, /1\|small/);
		});
	});

	describe("write action", () => {
		it("writes content to a file", async () => {
			const filePath = join(TEST_DIR, "write.txt");
			const result = await writeImpl({ path: filePath, content: "hello world" }, getOptions());
			assert.match(result, /Successfully wrote/);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "hello world");
		});

		it("creates parent directories", async () => {
			const filePath = join(TEST_DIR, "nested", "deep", "file.txt");
			const result = await writeImpl({ path: filePath, content: "nested" }, getOptions());
			assert.match(result, /Successfully wrote/);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "nested");
		});

		it("rejects content exceeding the max size", async () => {
			const filePath = join(TEST_DIR, "big.txt");
			const result = await writeImpl(
				{ path: filePath, content: "x".repeat(600 * 1024) },
				getOptions(),
			);
			assert.match(result, /exceeds maximum allowed size/);
		});
	});

	describe("edit action", () => {
		it("applies a string replacement", async () => {
			const filePath = join(TEST_DIR, "edit.txt");
			writeFileSync(filePath, "the quick brown fox");
			const result = await editImpl(
				{ path: filePath, oldString: "brown", newString: "red" },
				getOptions(),
			);
			assert.match(result, /Edit applied successfully/);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "the quick red fox");
		});

		it("returns an error when no match is found", async () => {
			const filePath = join(TEST_DIR, "edit-nomatch.txt");
			writeFileSync(filePath, "hello world");
			const result = await editImpl(
				{ path: filePath, oldString: "nonexistent", newString: "x" },
				getOptions(),
			);
			assert.match(result, /Edit failed/);
		});

		it("uses fuzzy matching for whitespace drift", async () => {
			const filePath = join(TEST_DIR, "edit-fuzzy.txt");
			writeFileSync(filePath, "hello   world");
			const result = await editImpl(
				{ path: filePath, oldString: "hello world", newString: "hi there" },
				getOptions(),
			);
			assert.match(result, /Edit applied successfully/);
		});
	});

	describe("delete action", () => {
		it("deletes a file", async () => {
			const filePath = join(TEST_DIR, "delete.txt");
			writeFileSync(filePath, "to delete");
			const result = await deleteImpl({ path: filePath }, getOptions());
			assert.match(result, /Successfully deleted/);
			assert.throws(() => readFileSync(filePath, "utf-8"));
		});

		it("returns an error for a missing file", async () => {
			const result = await deleteImpl({ path: join(TEST_DIR, "no-such.txt") }, getOptions());
			assert.match(result, /Error:/);
		});
	});

	describe("ls action", () => {
		it("lists directory entries", async () => {
			const dir = join(TEST_DIR, "lsdir");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "a");
			writeFileSync(join(dir, "b.txt"), "b");
			const result = await lsImpl({ path: dir }, getOptions());
			assert.match(result, /a\.txt/);
			assert.match(result, /b\.txt/);
		});
	});

	describe("glob action", () => {
		it("matches files by glob pattern", async () => {
			const dir = join(TEST_DIR, "globdir");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "one.js"), "x");
			writeFileSync(join(dir, "two.js"), "x");
			writeFileSync(join(dir, "three.txt"), "x");
			const result = await globImpl({ path: dir, glob: "**/*.js" }, getOptions());
			assert.match(result, /one\.js/);
			assert.match(result, /two\.js/);
			assert.ok(!result.includes("three.txt"));
		});
	});

	describe("search action", () => {
		it("finds matching lines", async () => {
			const dir = join(TEST_DIR, "searchdir");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "alpha\nbeta\ngamma\n");
			const result = await searchImpl({ path: dir, pattern: "beta" }, getOptions());
			assert.match(result, /beta/);
		});

		it("returns no matches when nothing matches", async () => {
			const dir = join(TEST_DIR, "searchdir2");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "alpha\n");
			const result = await searchImpl({ path: dir, pattern: "zzz" }, getOptions());
			assert.match(result, /No matches found/);
		});
	});

	describe("grep action", () => {
		it("finds matching lines", async () => {
			const dir = join(TEST_DIR, "grepdir");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "foo\nbar\nbaz\n");
			const result = await grepImpl({ path: dir, pattern: "bar" }, getOptions());
			assert.match(result, /bar/);
		});
	});

	describe("fileImpl dispatch", () => {
		it("dispatches to the correct action", async () => {
			const filePath = join(TEST_DIR, "dispatch.txt");
			const result = await fileImpl(
				{ action: "write", path: filePath, content: "data" },
				getOptions(),
			);
			assert.match(result, /Successfully wrote/);
		});

		it("returns an error for an unknown action", async () => {
			const result = await fileImpl({ action: "execute", path: "/tmp/x" }, getOptions());
			assert.match(result, /Unknown action/);
		});
	});

	describe("helpers", () => {
		it("generateUnifiedDiff produces a diff", () => {
			const diff = generateUnifiedDiff("old\n", "new\n");
			assert.match(diff, /--- a\/file/);
			assert.match(diff, /-old/);
			assert.match(diff, /\+new/);
		});

		it("fuzzyMatch finds an exact match", () => {
			const result = fuzzyMatch("hello", "say hello world");
			assert.strictEqual(result[0].found, true);
		});

		it("levenshteinDistance computes edit distance", () => {
			assert.strictEqual(levenshteinDistance("kitten", "sitting"), 3);
			assert.strictEqual(levenshteinDistance("same", "same"), 0);
		});
	});
});
