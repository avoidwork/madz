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
	resolveBaseDir,
	resolveFilePath,
	generateUnifiedDiff,
	fuzzyMatch,
	levenshteinDistance,
} from "../../../src/tools/file/index.js";
import { setProjectCwd } from "../../../src/workspace/project.js";

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

		it("accepts an action without a path (defaults to project cwd)", () => {
			const result = file.schema.safeParse({ action: "read" });
			assert.strictEqual(result.success, true);
		});

		it("rejects a missing action", () => {
			const result = file.schema.safeParse({ path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a discovery action", () => {
			for (const action of ["ls", "glob", "grep"]) {
				const result = file.schema.safeParse({ action, path: "/tmp/x" });
				assert.strictEqual(result.success, false, `action ${action} should be invalid`);
			}
		});

		it("accepts all valid actions", () => {
			for (const action of ["read", "write", "edit", "delete"]) {
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
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.content, "line one\nline two\nline three\n");
			assert.deepStrictEqual(result.lines, ["1|line one", "2|line two", "3|line three", "4|"]);
		});

		it("supports offset/limit pagination", async () => {
			const filePath = join(TEST_DIR, "pagination.txt");
			writeFileSync(filePath, "a\nb\nc\nd\ne\n");
			const result = await readImpl({ path: filePath, offset: 1, limit: 2 }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.lines, ["2|b", "3|c"]);
			assert.ok(!result.lines.includes("1|a"));
		});

		it("returns an error for a missing file", async () => {
			const result = await readImpl({ path: join(TEST_DIR, "missing.txt") }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /File not found/);
		});
	});

	describe("path validation", () => {
		it("denies a path outside the sandbox allowlist", async () => {
			const result = await readImpl({ path: "/etc/passwd" }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Access denied/);
		});

		it("denies a write outside the sandbox allowlist", async () => {
			const result = await writeImpl({ path: "/etc/passwd", content: "x" }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Access denied/);
		});

		it("allows a path inside the sandbox allowlist", async () => {
			const filePath = join(TEST_DIR, "allowed.txt");
			const result = await writeImpl({ path: filePath, content: "hello" }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.path, filePath);
			assert.strictEqual(result.bytesWritten, 5);
		});
	});

	describe("default path resolution", () => {
		it("resolveBaseDir falls back to config.cwd when no project is active", () => {
			setProjectCwd("");
			const base = resolveBaseDir();
			assert.strictEqual(typeof base, "string");
			assert.ok(base.length > 0);
		});

		it("resolveBaseDir prefers the active project cwd", () => {
			setProjectCwd("/tmp/project-a");
			assert.strictEqual(resolveBaseDir(), "/tmp/project-a");
			setProjectCwd("");
		});

		it("resolveFilePath returns the base dir when path is omitted", () => {
			setProjectCwd("/tmp/project-a");
			assert.strictEqual(resolveFilePath(), "/tmp/project-a");
			setProjectCwd("");
		});

		it("resolveFilePath resolves a relative path against the project cwd", () => {
			setProjectCwd("/tmp/project-a");
			assert.strictEqual(resolveFilePath("src/index.js"), "/tmp/project-a/src/index.js");
			setProjectCwd("");
		});

		it("resolveFilePath leaves an absolute path unchanged", () => {
			setProjectCwd("/tmp/project-a");
			assert.strictEqual(resolveFilePath("/etc/passwd"), "/etc/passwd");
			setProjectCwd("");
		});

		it("readImpl resolves a relative path against the active project cwd", async () => {
			const projectDir = join(TEST_DIR, "default-read");
			mkdirSync(projectDir, { recursive: true });
			writeFileSync(join(projectDir, "b.txt"), "hello");
			setProjectCwd(projectDir);
			const result = await readImpl({ action: "read", path: "b.txt" }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.lines, ["1|hello"]);
			setProjectCwd("");
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
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /exceeds max read size/);
		});

		it("reads a file within the max read size", async () => {
			const filePath = join(TEST_DIR, "small.txt");
			writeFileSync(filePath, "small");
			const result = await readImpl(
				{ path: filePath },
				{ allowedPaths: ALLOWED_PATHS, maxReadSize: "1kb" },
			);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.lines, ["1|small"]);
		});
	});

	describe("write action", () => {
		it("writes content to a file", async () => {
			const filePath = join(TEST_DIR, "write.txt");
			const result = await writeImpl({ path: filePath, content: "hello world" }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.path, filePath);
			assert.strictEqual(result.bytesWritten, 11);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "hello world");
		});

		it("creates parent directories", async () => {
			const filePath = join(TEST_DIR, "nested", "deep", "file.txt");
			const result = await writeImpl({ path: filePath, content: "nested" }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "nested");
		});

		it("rejects content exceeding the max size", async () => {
			const filePath = join(TEST_DIR, "big.txt");
			const result = await writeImpl(
				{ path: filePath, content: "x".repeat(600 * 1024) },
				getOptions(),
			);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /exceeds maximum allowed size/);
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
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.changes, 1);
			assert.match(result.diff, /-brown/);
			assert.match(result.diff, /\+red/);
			assert.strictEqual(readFileSync(filePath, "utf-8"), "the quick red fox");
		});

		it("returns an error when no match is found", async () => {
			const filePath = join(TEST_DIR, "edit-nomatch.txt");
			writeFileSync(filePath, "hello world");
			const result = await editImpl(
				{ path: filePath, oldString: "nonexistent", newString: "x" },
				getOptions(),
			);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Could not find matching text/);
		});

		it("uses fuzzy matching for whitespace drift", async () => {
			const filePath = join(TEST_DIR, "edit-fuzzy.txt");
			writeFileSync(filePath, "hello   world");
			const result = await editImpl(
				{ path: filePath, oldString: "hello world", newString: "hi there" },
				getOptions(),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.changes, 1);
		});
	});

	describe("delete action", () => {
		it("deletes a file", async () => {
			const filePath = join(TEST_DIR, "delete.txt");
			writeFileSync(filePath, "to delete");
			const result = await deleteImpl({ path: filePath }, getOptions());
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.path, filePath);
			assert.throws(() => readFileSync(filePath, "utf-8"));
		});

		it("returns an error for a missing file", async () => {
			const result = await deleteImpl({ path: join(TEST_DIR, "no-such.txt") }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /ENOENT/);
		});
	});

	describe("fileImpl dispatch", () => {
		it("dispatches to the correct action", async () => {
			const filePath = join(TEST_DIR, "dispatch.txt");
			const result = await fileImpl(
				{ action: "write", path: filePath, content: "data" },
				getOptions(),
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.path, filePath);
		});

		it("returns an error for an unknown action", async () => {
			const result = await fileImpl({ action: "execute", path: "/tmp/x" }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Unknown action/);
		});

		it("returns an error for a discovery action", async () => {
			const result = await fileImpl({ action: "ls", path: "/tmp/x" }, getOptions());
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Unknown action/);
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
