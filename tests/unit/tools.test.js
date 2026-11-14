import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { validatePath, checkFileLimit } from "../../src/tools/common.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("tools - validatePath", () => {
	it("allows path within sandbox scope", () => {
		const result = validatePath("memory/test.md", ["memory/"]);
		assert.strictEqual(result.allowed, true);
		assert.ok(result.path.includes("memory"));
	});

	it("allows nested path within scope", () => {
		const result = validatePath("memory/sub/file.txt", ["memory/"]);
		assert.strictEqual(result.allowed, true);
	});

	it("rejects path outside sandbox", () => {
		const result = validatePath("/etc/passwd", ["memory/"]);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.error.includes("outside sandbox"));
	});

	it("rejects path with parent traversal outside scope", () => {
		const result = validatePath("memory/../../../etc/passwd", ["memory/"]);
		assert.strictEqual(result.allowed, false);
	});

	it("allows path in multiple scopes", () => {
		const result = validatePath("skills/my-skill/main.js", ["memory/", "skills/"]);
		assert.strictEqual(result.allowed, true);
	});
});

describe("tools - checkFileLimit", () => {
	const testDir = join(process.cwd(), "memory", "__test_tmp__");
	const testFile = join(testDir, "test.txt");
	const largeFile = join(testDir, "large.txt");

	before(() => {
		mkdirSync(testDir, { recursive: true });
		writeFileSync(testFile, "hello world");
	});

	it("returns ok when file is within limit", async () => {
		const result = await checkFileLimit(testFile, 1024 * 1024);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.size, 11);
	});

	it("returns error for non-existent file", async () => {
		const result = await checkFileLimit(join(testDir, "nonexistent.txt"), 1024 * 1024);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("returns error when file exceeds max size", async () => {
		const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB
		writeFileSync(largeFile, largeContent);
		const result = await checkFileLimit(largeFile, 1024 * 1024);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds"));
	});

	after(() => {
		rmSync(testDir, { recursive: true, force: true });
	});
});
