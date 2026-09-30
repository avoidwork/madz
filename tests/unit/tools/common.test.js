import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import {
	validatePath,
	validateUrl,
	fetchWithTimeout,
	checkFileLimit,
	parseSizeString,
} from "../../../src/tools/common.js";
import { setTestMode } from "../../../src/sandbox/urlFilter.js";

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

// --- validateUrl ---

describe("validateUrl", () => {
	it("allows http URLs", () => {
		const result = validateUrl("http://api.example.com/health", ["api.example.com"]);
		assert.strictEqual(result.allowed, true);
	});

	it("blocks file:// scheme", () => {
		const result = validateUrl("file:///etc/passwd");
		assert.strictEqual(result.allowed, false);
	});

	it("blocks gopher:// scheme", () => {
		const result = validateUrl("gopher://example.com");
		assert.strictEqual(result.allowed, false);
	});

	it("blocks dict:// scheme", () => {
		const result = validateUrl("dict://example.com");
		assert.strictEqual(result.allowed, false);
	});

	it("rejects URLs not on allowlist", () => {
		const result = validateUrl("http://evil.com", ["api.example.com"]);
		assert.strictEqual(result.allowed, false);
	});

	it("accepts valid URL on allowlist", () => {
		const result = validateUrl("https://api.example.com/v1/data", ["api.example.com"]);
		assert.strictEqual(result.allowed, true);
	});

	it("handles invalid URLs", () => {
		const result = validateUrl("not-a-url");
		assert.strictEqual(result.allowed, false);
	});

	it("handles empty URL", () => {
		const result = validateUrl("");
		assert.strictEqual(result.allowed, false);
		assert.ok(result.reason.includes("Invalid URL"));
	});

	it("handles null URL", () => {
		const result = validateUrl(null);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.reason.includes("Invalid URL"));
	});

	it("handles non-string URL", () => {
		const result = validateUrl(42);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.reason.includes("Invalid URL"));
	});

	it("works without allowlist", () => {
		const result = validateUrl("http://any-domain.com/path");
		assert.strictEqual(result.allowed, true);
	});
});

// --- fetchWithTimeout ---

describe("fetchWithTimeout", () => {
	let server;
	let baseUrl;

	before(() => {
		setTestMode(true);
		return new Promise((resolve) => {
			server = createServer((req, res) => {
				if (req.url === "/ok") {
					res.writeHead(200, { "Content-Type": "text/plain" });
					res.end("hello world");
				} else if (req.url === "/slow") {
					// Delay then respond
					setTimeout(() => {
						res.writeHead(200);
						res.end("slow response");
					}, 200);
				} else if (req.url === "/error") {
					res.writeHead(500);
					res.end("server error");
				} else {
					res.writeHead(404);
					res.end("not found");
				}
			});
			server.listen(0, () => {
				baseUrl = `http://127.0.0.1:${server.address().port}`;
				resolve();
			});
		});
	});

	after(() => {
		setTestMode(false);
		if (server) server.close();
	});

	it("fetches successfully", async () => {
		const result = await fetchWithTimeout(`${baseUrl}/ok`, 5000);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.body, "hello world");
	});

	it("returns error for blocked URL", async () => {
		const result = await fetchWithTimeout("file:///etc/passwd", 5000);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("returns error for HTTP error status", async () => {
		const result = await fetchWithTimeout(`${baseUrl}/error`, 5000);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("HTTP 500"));
	});

	it("returns error for 404", async () => {
		const result = await fetchWithTimeout(`${baseUrl}/notfound`, 5000);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("HTTP 404"));
	});

	it("times out on slow request with short timeout", async () => {
		const result = await fetchWithTimeout(`${baseUrl}/slow`, 50);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("timed out"));
	});

	it("rejects URL not on allowlist", async () => {
		const result = await fetchWithTimeout("http://evil.com/path", 5000, ["good.com"]);
		assert.strictEqual(result.ok, false);
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
		const result = await checkFileLimit(filePath, "1mb");
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
		const result = await checkFileLimit("/nonexistent/path/file.txt", "1mb");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("File not found"));
	});

	it("handles zero-byte file", async () => {
		const filePath = join(testDir, "empty.txt");
		writeFileSync(filePath, "");
		const result = await checkFileLimit(filePath, "1mb");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.size, 0);
	});
});
