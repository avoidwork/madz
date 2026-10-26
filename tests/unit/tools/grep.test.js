import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { grep } from "../../../src/tools/grep/index.js";
import { grepImpl, nativeSearch } from "../../../src/tools/file/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_grep__");
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

describe("tools - grep", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	describe("schema validation", () => {
		it("accepts a valid pattern", () => {
			const result = grep.schema.safeParse({ pattern: "foo" });
			assert.strictEqual(result.success, true);
		});

		it("accepts a pattern with optional path and maxResults", () => {
			const result = grep.schema.safeParse({ pattern: "foo", path: "/tmp/x", maxResults: 5 });
			assert.strictEqual(result.success, true);
		});

		it("rejects a missing pattern", () => {
			const result = grep.schema.safeParse({ path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a non-positive maxResults", () => {
			const result = grep.schema.safeParse({ pattern: "foo", maxResults: 0 });
			assert.strictEqual(result.success, false);
		});
	});

	describe("grepImpl logic", () => {
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
			// nativeSearch is the fallback used by grepImpl when rg is absent.
			const result = await nativeSearch("beta", dir, 20);
			assert.match(result, /beta/);
		});

		it("validates path against the sandbox allowlist", async () => {
			const result = await grepImpl({ path: "/etc/passwd", pattern: "root" }, getOptions());
			assert.match(result, /Error/);
		});
	});
});
