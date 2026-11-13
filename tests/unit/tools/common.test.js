import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePath, checkFileLimit, parseSizeString } from "../../../src/tools/common.js";

// --- parseSizeString ---

describe("parseSizeString", () => {
	it("parses bytes", () => {
		assert.strictEqual(parseSizeString("500b"), 500);
	});

	it("parses kilobytes", () => {
		assert.strictEqual(parseSizeString("1kb"), 1024);
	});

	it("parses megabytes", () => {
		assert.strictEqual(parseSizeString("1mb"), 1024 * 1024);
	});

	it("parses gigabytes", () => {
		assert.strictEqual(parseSizeString("1gb"), 1024 * 1024 * 1024);
	});

	it("parses decimal values", () => {
		assert.strictEqual(parseSizeString("1.5mb"), Math.floor(1.5 * 1024 * 1024));
	});

	it("defaults to 1mb for invalid strings", () => {
		assert.strictEqual(parseSizeString("invalid"), 1024 * 1024);
	});

	it("handles whitespace around value", () => {
		assert.strictEqual(parseSizeString("  2mb  "), 2 * 1024 * 1024);
	});

	it("handles uppercase units", () => {
		assert.strictEqual(parseSizeString("2MB"), 2 * 1024 * 1024);
	});

	it("defaults to bytes when no unit given", () => {
		assert.strictEqual(parseSizeString("100"), 100);
	});
});

// --- validatePath ---

describe("validatePath", () => {
	it("returns allowed for path within scope", () => {
		const result = validatePath("memory/test.md", ["memory/"]);
		assert.strictEqual(result.allowed, true);
		assert.ok(result.path);
	});

	it("returns denied for path outside scope", () => {
		const result = validatePath("/etc/passwd", ["memory/"]);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.error.includes("Access denied"));
	});

	it("returns denied for path with parent traversal", () => {
		const result = validatePath("memory/../../../etc/passwd", ["memory/"]);
		assert.strictEqual(result.allowed, false);
	});

	it("allows when multiple scopes match", () => {
		const result = validatePath("skills/script.sh", ["memory/", "skills/"]);
		assert.strictEqual(result.allowed, true);
	});

	it("rejects with empty allowedPaths", () => {
		const result = validatePath("/any/path", []);
		assert.strictEqual(result.allowed, false);
	});
});

// --- checkFileLimit ---

describe("checkFileLimit", () => {
	const testDir = join(tmpdir(), "madz-checkfilelimit-" + Date.now());

	before(() => {
		mkdirSync(testDir, { recursive: true });
	});

	after(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it("returns ok for small file", async () => {
		const filePath = join(testDir, "small.txt");
		writeFileSync(filePath, "hello");
		const result = await checkFileLimit(filePath, 1024 * 1024);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.size, 5);
	});

	it("returns error for file exceeding limit", async () => {
		const filePath = join(testDir, "large.txt");
		writeFileSync(filePath, "x".repeat(200));
		const result = await checkFileLimit(filePath, "100b");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds max read size"));
		assert.strictEqual(result.size, 200);
		assert.strictEqual(result.limit, 100);
	});

	it("returns error for nonexistent file", async () => {
		const result = await checkFileLimit("/nonexistent/path/file.txt", 1024 * 1024);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("File not found"));
	});

	it("handles zero-byte file", async () => {
		const filePath = join(testDir, "empty.txt");
		writeFileSync(filePath, "");
		const result = await checkFileLimit(filePath, 1024 * 1024);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.size, 0);
	});
});
