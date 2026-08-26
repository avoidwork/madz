import { describe, it } from "node:test";
import assert from "node:assert";
import { apiImpl, rateLimit } from "../../src/tools/api.js";
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
});
