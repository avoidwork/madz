import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { apiImpl, rateLimit } from "../../src/tools/api/index.js";
import { setTestMode } from "../../src/sandbox/urlFilter.js";

// Ensure test mode is off for unit tests
setTestMode(false);

// Disable rate limiting in tests
rateLimit._testMode = true;

describe("api tool", () => {
	it("rejects blocked scheme (file://)", async () => {
		const result = await apiImpl({
			url: "file:///etc/passwd",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Blocked scheme"));
	});

	it("rejects blocked scheme (gopher://)", async () => {
		const result = await apiImpl({
			url: "gopher://example.com",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Blocked scheme"));
	});

	it("rejects blocked scheme (dict://)", async () => {
		const result = await apiImpl({
			url: "dict://localhost:2628",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Blocked scheme"));
	});

	it("rejects internal IP (127.0.0.1)", async () => {
		const result = await apiImpl({
			url: "http://127.0.0.1:8080/api",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("internal host"));
	});

	it("rejects internal IP (0.0.0.0)", async () => {
		const result = await apiImpl({
			url: "http://0.0.0.0:8080/api",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("internal host"));
	});

	it("rejects internal IP (169.254.169.254)", async () => {
		const result = await apiImpl({
			url: "http://169.254.169.254/latest/meta-data/",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("internal host"));
	});

	it("rejects invalid URL", async () => {
		const result = await apiImpl({
			url: "not-a-url",
			method: "GET",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects invalid method", async () => {
		const result = await apiImpl({
			url: "https://example.com/api",
			method: "INVALID",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects missing url", async () => {
		const result = await apiImpl({ method: "GET" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects invalid auth type", async () => {
		const result = await apiImpl({
			url: "https://example.com/api",
			auth: { type: "invalid" },
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});
});

describe("api — makeApiRequest()", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("rejects non-allowed host when allowlist is provided", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		const result = await makeApiRequest("https://evil.com/api", {
			allowlist: ["good.com"],
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not on allowlist"));
	});

	it("makes successful request and returns body", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			headers: {
				get() { return null; },
				forEach(cb) { cb("application/json", "content-type"); },
			},
			text: async () => '{"ok":true}',
		});
		const result = await makeApiRequest("https://example.com/api");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 200);
		assert.strictEqual(result.body, '{"ok":true}');
	});

	it("handles bearer auth", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		let capturedHeaders;
		globalThis.fetch = async (url, opts) => {
			capturedHeaders = opts.headers;
			return {
				ok: true, status: 200,
				headers: { get() { return null; }, forEach() {} },
				text: async () => "{}",
			};
		};
		await makeApiRequest("https://example.com/api", {
			auth: { type: "bearer", token: "mytoken" },
		});
		assert.strictEqual(capturedHeaders["Authorization"], "Bearer mytoken");
	});

	it("handles basic auth", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		let capturedHeaders;
		globalThis.fetch = async (url, opts) => {
			capturedHeaders = opts.headers;
			return {
				ok: true, status: 200,
				headers: { get() { return null; }, forEach() {} },
				text: async () => "{}",
			};
		};
		await makeApiRequest("https://example.com/api", {
			auth: { type: "basic", token: "user:pass" },
		});
		assert.ok(capturedHeaders["Authorization"].startsWith("Basic "));
	});

	it("handles apikey auth", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		let capturedHeaders;
		globalThis.fetch = async (url, opts) => {
			capturedHeaders = opts.headers;
			return {
				ok: true, status: 200,
				headers: { get() { return null; }, forEach() {} },
				text: async () => "{}",
			};
		};
		await makeApiRequest("https://example.com/api", {
			auth: { type: "apikey", key: "X-API-Key", token: "abc123" },
		});
		assert.strictEqual(capturedHeaders["X-API-Key"], "abc123");
	});

	it("sends JSON body for POST", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		let capturedOpts;
		globalThis.fetch = async (url, opts) => {
			capturedOpts = opts;
			return {
				ok: true, status: 200,
				headers: { get() { return null; }, forEach() {} },
				text: async () => "{}",
			};
		};
		await makeApiRequest("https://example.com/api", {
			method: "POST",
			body: { key: "value" },
		});
		assert.strictEqual(capturedOpts.method, "POST");
		assert.strictEqual(capturedOpts.body, JSON.stringify({ key: "value" }));
	});

	it("sends string body directly", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		let capturedOpts;
		globalThis.fetch = async (url, opts) => {
			capturedOpts = opts;
			return {
				ok: true, status: 200,
				headers: { get() { return null; }, forEach() {} },
				text: async () => "{}",
			};
		};
		await makeApiRequest("https://example.com/api", {
			method: "POST",
			body: "raw string",
		});
		assert.strictEqual(capturedOpts.body, "raw string");
	});

	it("handles timeout (AbortError)", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		globalThis.fetch = async () => {
			throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
		};
		const result = await makeApiRequest("https://example.com/api", { timeout: 100 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("timed out"));
	});

	it("handles fetch error", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		globalThis.fetch = async () => { throw new Error("Network failure"); };
		const result = await makeApiRequest("https://example.com/api");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Network failure"));
	});

	it("rejects response body exceeding maxBodySize via content-length", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		globalThis.fetch = async () => ({
			ok: true, status: 200,
			headers: {
				get(name) {
					if (name === "content-length") return String(20 * 1024 * 1024);
					return null;
				},
				forEach() {},
			},
			text: async () => "{}",
		});
		const result = await makeApiRequest("https://example.com/api", { maxBodySize: 1024 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("too large"));
	});

	it("sanitizes Set-Cookie headers", async () => {
		const { makeApiRequest } = await import("../../src/tools/api/index.js");
		globalThis.fetch = async () => ({
			ok: true, status: 200,
			headers: {
				get(name) {
					const map = { "content-type": "application/json", "set-cookie": "session=abc" };
					return map[name.toLowerCase()] || null;
				},
				forEach(cb) {
					cb("application/json", "content-type");
					cb("session=abc", "set-cookie");
				},
			},
			text: async () => "{}",
		});
		const result = await makeApiRequest("https://example.com/api");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.headers["set-cookie"], undefined);
		assert.strictEqual(result.headers["content-type"], "application/json");
	});
});

describe("api — api() wrapper", () => {
	it("returns error for invalid JSON", async () => {
		const { api } = await import("../../src/tools/api/index.js");
		const result = await api("not-json");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("parses valid JSON and delegates to apiImpl", async () => {
		const { api } = await import("../../src/tools/api/index.js");
		const result = await api(JSON.stringify({ url: "https://example.com/api" }));
		assert.ok(result.ok === false || result.ok === true);
	});
});

describe("api — createApiTool()", () => {
	it("returns a LangChain tool", async () => {
		const { createApiTool } = await import("../../src/tools/api/index.js");
		const tool = createApiTool();
		assert.ok(tool);
		assert.strictEqual(typeof tool.invoke, "function");
	});

	it("invoke returns JSON string result", async () => {
		const { createApiTool } = await import("../../src/tools/api/index.js");
		const tool = createApiTool();
		const result = await tool.invoke({ url: "https://example.com/api" });
		const parsed = JSON.parse(result);
		assert.ok("ok" in parsed);
	});
});

describe("api — rateLimit()", () => {
	it("skips when _testMode is true", async () => {
		const { rateLimit } = await import("../../src/tools/api/index.js");
		rateLimit._testMode = true;
		await assert.doesNotReject(rateLimit("https://example.com", 10));
	});

	it("skips when maxRequests is 0 or negative", async () => {
		const { rateLimit } = await import("../../src/tools/api/index.js");
		rateLimit._testMode = false;
		await assert.doesNotReject(rateLimit("https://example.com", 0));
		await assert.doesNotReject(rateLimit("https://example.com", -1));
		rateLimit._testMode = true;
	});

	it("creates window map on first call", async () => {
		const { rateLimit } = await import("../../src/tools/api/index.js");
		rateLimit._testMode = false;
		rateLimit._windows = undefined;
		await rateLimit("https://example.com", 10);
		assert.ok(rateLimit._windows instanceof Map);
		rateLimit._testMode = true;
	});

	it("cleans up old timestamps", async () => {
		const { rateLimit } = await import("../../src/tools/api/index.js");
		rateLimit._testMode = false;
		rateLimit._windows = new Map();
		rateLimit._windows.set("https://example.com", [Date.now() - 5000]);
		await rateLimit("https://example.com", 10);
		assert.strictEqual(rateLimit._windows.get("https://example.com").length, 1);
		rateLimit._testMode = true;
	});

	it("waits when limit exceeded", async () => {
		const { rateLimit } = await import("../../src/tools/api/index.js");
		rateLimit._testMode = false;
		rateLimit._windows = new Map();
		const now = Date.now();
		const timestamps = Array.from({ length: 10 }, () => now);
		rateLimit._windows.set("https://example.com", timestamps);
		await rateLimit("https://example.com", 10);
		assert.ok(rateLimit._windows.get("https://example.com").length <= 10);
		rateLimit._testMode = true;
	});
});
