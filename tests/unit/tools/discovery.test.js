import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discovery, discoveryImpl, lsImpl, globImpl } from "../../../src/tools/discovery/index.js";

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
	return { allowedPaths: ALLOWED_PATHS };
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

		it("rejects an unknown action", () => {
			const result = discovery.schema.safeParse({ action: "read", path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("rejects a missing action", () => {
			const result = discovery.schema.safeParse({ path: "/tmp/x" });
			assert.strictEqual(result.success, false);
		});

		it("accepts an action without a path (defaults to project cwd)", () => {
			const result = discovery.schema.safeParse({ action: "ls" });
			assert.strictEqual(result.success, true);
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

		it("returns an error for a missing directory", async () => {
			const result = await lsImpl({ path: join(TEST_DIR, "no-such-dir") }, getOptions());
			assert.match(result, /Error:/);
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

		it("returns no matches when nothing matches", async () => {
			const dir = join(TEST_DIR, "globdir2");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "x");
			const result = await globImpl({ path: dir, pattern: "**/*.js" }, getOptions());
			assert.match(result, /No files match/);
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
			writeFileSync(join(dir, "x.txt"), "x");
			const result = await lsImpl({ path: dir }, getOptions());
			assert.match(result, /x\.txt/);
		});
	});

	describe("discoveryImpl dispatch", () => {
		it("dispatches to the correct action", async () => {
			const dir = join(TEST_DIR, "dispatch");
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "a.txt"), "a");
			const result = await discoveryImpl({ action: "ls", path: dir }, getOptions());
			assert.match(result, /a\.txt/);
		});

		it("returns an error for an unknown action", async () => {
			const result = await discoveryImpl({ action: "execute", path: "/tmp/x" }, getOptions());
			assert.match(result, /Unknown action/);
		});
	});
});
