import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	discovery,
	discoveryImpl,
	lsImpl,
	globImpl,
	grepImpl,
	nativeSearch,
	resolveBaseDir,
	resolveFilePath,
} from "../../../src/tools/discovery/index.js";
import { setProjectCwd } from "../../../src/workspace/project.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_discovery__");
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

describe("tools - discovery", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	describe("schema validation", () => {
		it("accepts a valid ls action", () => {
			const result = discovery.schema.safeParse({ action: "ls", path: "/tmp/x" });
			assert.strictEqual(result.success, true);
		});

		it("accepts a valid glob action", () => {
			const result = discovery.schema.safeParse({
				action: "glob",
				path: "/tmp/x",
				pattern: "**/*.js",
			});
			assert.strictEqual(result.success, true);
		});

		it("accepts a valid grep action", () => {
			const result = discovery.schema.safeParse({ action: "grep", path: "/tmp/x", pattern: "foo" });
			assert.strictEqual(result.success, true);
		});

		it("rejects an unknown action", () => {
			const result = discovery.schema.safeParse({ action: "read", path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a missing action", () => {
			const result = discovery.schema.safeParse({ path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("accepts all valid actions", () => {
			for (const action of ["ls", "glob", "grep"]) {
				const result = discovery.schema.safeParse({ action, path: "/tmp/x" });
				assert.strictEqual(result.success, true, `action ${action} should be valid`);
			}
		});
	});

	describe("path validation", () => {
		it("denies a path outside the sandbox allowlist", async () => {
			const result = await lsImpl({ path: "/etc/passwd" }, getOptions());
			assert.match(result, /Access denied/);
		});

		it("allows a path inside the sandbox allowlist", async () => {
			const dir = join(TEST_DIR, "allowed");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "a");
			const result = await lsImpl({ path: dir }, getOptions());
			assert.match(result, /a\.txt/);
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

		it("lsImpl defaults to the active project cwd when path is omitted", async () => {
			const projectDir = join(TEST_DIR, "default-ls");
			mkdirSync(projectDir, { recursive: true });
			writeFileSync(join(projectDir, "a.txt"), "a");
			setProjectCwd(projectDir);
			const result = await lsImpl({ action: "ls" }, getOptions());
			assert.match(result, /a\.txt/);
			setProjectCwd("");
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
			const result = await globImpl({ path: dir, pattern: "**/*.js" }, getOptions());
			assert.match(result, /one\.js/);
			assert.match(result, /two\.js/);
			assert.ok(!result.includes("three.txt"));
		});

		it("returns no matches for an empty glob", async () => {
			const dir = join(TEST_DIR, "globempty");
			mkdirSync(dir, { recursive: true });
			const result = await globImpl({ path: dir, pattern: "**/*.xyz" }, getOptions());
			assert.match(result, /No files match/);
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

		it("returns no matches when nothing matches", async () => {
			const dir = join(TEST_DIR, "grepdir2");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "foo\n");
			const result = await grepImpl({ path: dir, pattern: "zzz" }, getOptions());
			assert.match(result, /No matches found/);
		});

		it("uses native search as the fallback when rg is unavailable", async () => {
			const dir = join(TEST_DIR, "grepdir3");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "alpha\nbeta\ngamma\n");
			const result = await nativeSearch("beta", dir, 20);
			assert.match(result, /beta/);
		});

		it("validates path against the sandbox allowlist", async () => {
			const result = await grepImpl({ path: "/etc/passwd", pattern: "root" }, getOptions());
			assert.match(result, /Error/);
		});
	});

	describe("discoveryImpl dispatch", () => {
		it("dispatches to the correct action", async () => {
			const dir = join(TEST_DIR, "dispatch");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "x");
			const result = await discoveryImpl({ action: "ls", path: dir }, getOptions());
			assert.match(result, /a\.txt/);
		});

		it("returns an error for an unknown action", async () => {
			const result = await discoveryImpl({ action: "read", path: "/tmp/x" }, getOptions());
			assert.match(result, /Unknown action/);
		});
	});
});
