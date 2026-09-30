import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
	validatePath,
	validateUrl,
	fetchWithTimeout,
	parseSizeString,
	checkFileLimit,
} from "../../src/tools/common.js";
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

describe("tools - validateUrl", () => {
	it("allows valid http URL without allowlist", () => {
		const result = validateUrl("http://example.com/api");
		assert.strictEqual(result.allowed, true);
	});

	it("blocks file:// scheme", () => {
		const result = validateUrl("file:///etc/passwd");
		assert.strictEqual(result.allowed, false);
		assert.ok(
			result.reason.toLowerCase().includes("blocked") ||
				result.reason.toLowerCase().includes("scheme"),
		);
	});

	it("blocks gopher:// scheme", () => {
		const result = validateUrl("gopher://example.com");
		assert.strictEqual(result.allowed, false);
	});

	it("rejects empty URL", () => {
		const result = validateUrl("");
		assert.strictEqual(result.allowed, false);
	});

	it("rejects null URL", () => {
		const result = validateUrl(null);
		assert.strictEqual(result.allowed, false);
	});

	it("rejects invalid URL format", () => {
		const result = validateUrl("not-a-valid-url");
		assert.strictEqual(result.allowed, false);
	});

	it("checks URL against allowlist", () => {
		const result = validateUrl("http://allowed.com/api", ["allowed.com"]);
		assert.strictEqual(result.allowed, true);
	});
});

describe("tools - fetchWithTimeout", () => {
	it("rejects blocked scheme URL", async () => {
		const result = await fetchWithTimeout("file:///etc/passwd");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("rejects unreachable URL with timeout", async () => {
		const result = await fetchWithTimeout("http://localhost:59999/slow", 500);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("succeeds with valid response", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => '{"hello":"world"}',
		});
		const result = await fetchWithTimeout("https://httpbin.org/get", 5000);
		assert.strictEqual(result.ok, true);
		assert.ok(result.body);
		globalThis.fetch = undefined;
	});

	it("handles HTTP error status", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 503,
			text: async () => "Service Unavailable",
		});
		const result = await fetchWithTimeout("https://httpbin.org/status/503", 5000);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("503"));
		globalThis.fetch = undefined;
	});

	it("handles abort error as timeout", async () => {
		globalThis.fetch = async () => {
			throw new Error("Request timed out");
		};
		const result = await fetchWithTimeout("http://localhost:59999/slow", 100);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
		globalThis.fetch = undefined;
	});
});

describe("tools - parseSizeString", () => {
	it("parses '1mb' to bytes", () => {
		assert.strictEqual(parseSizeString("1mb"), 1024 * 1024);
	});

	it("parses '512kb' to bytes", () => {
		assert.strictEqual(parseSizeString("512kb"), 512 * 1024);
	});

	it("parses '1024' as bytes", () => {
		assert.strictEqual(parseSizeString("1024"), 1024);
	});

	it("parses '2gb' to bytes", () => {
		assert.strictEqual(parseSizeString("2gb"), 2 * 1024 * 1024 * 1024);
	});

	it("defaults to 1mb for invalid string", () => {
		assert.strictEqual(parseSizeString("invalid"), 1024 * 1024);
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
		const result = await checkFileLimit(testFile, "1mb");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.size, 11);
	});

	it("returns error for non-existent file", async () => {
		const result = await checkFileLimit(join(testDir, "nonexistent.txt"), "1mb");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("returns error when file exceeds max size", async () => {
		const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB
		writeFileSync(largeFile, largeContent);
		const result = await checkFileLimit(largeFile, "1mb");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds"));
	});

	after(() => {
		rmSync(testDir, { recursive: true, force: true });
	});
});
