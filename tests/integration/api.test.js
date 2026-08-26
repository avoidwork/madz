import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { makeApiRequest } from "../../src/tools/api.js";

describe("api integration tests", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	function mockFetch(resp) {
		globalThis.fetch = async (_url, _opts) => resp;
	}

	it("makes a GET request", async () => {
		mockFetch({
			ok: true,
			status: 200,
			headers: new Map([["content-type", "application/json"]]),
			text: async () => JSON.stringify({ message: "GET response", path: "/test" }),
		});
		const result = await makeApiRequest("https://example.com/test", { method: "GET" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 200);
		assert.strictEqual(result.body, JSON.stringify({ message: "GET response", path: "/test" }));
	});

	it("makes a POST request with body", async () => {
		mockFetch({
			ok: true,
			status: 200,
			headers: new Map([["content-type", "application/json"]]),
			text: async () => JSON.stringify({ message: "POST response", received: '{"key":"value"}' }),
		});
		const result = await makeApiRequest("https://example.com/test", {
			method: "POST",
			body: { key: "value" },
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 200);
		assert.ok(result.body.includes("key"));
		assert.ok(result.body.includes("value"));
	});

	it("makes a PUT request with body", async () => {
		mockFetch({
			ok: true,
			status: 200,
			headers: new Map([["content-type", "application/json"]]),
			text: async () => JSON.stringify({ message: "PUT response", received: '{"key":"updated"}' }),
		});
		const result = await makeApiRequest("https://example.com/test", {
			method: "PUT",
			body: { key: "updated" },
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 200);
		assert.ok(result.body.includes("key"));
		assert.ok(result.body.includes("updated"));
	});

	it("makes a DELETE request", async () => {
		mockFetch({
			ok: true,
			status: 200,
			headers: new Map([["content-type", "application/json"]]),
			text: async () => JSON.stringify({ message: "DELETE response" }),
		});
		const result = await makeApiRequest("https://example.com/test", { method: "DELETE" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 200);
		assert.strictEqual(result.body, JSON.stringify({ message: "DELETE response" }));
	});

	it("strips sensitive headers from response", async () => {
		const headers = new Map([
			["content-type", "application/json"],
			["x-test-header", "test-value"],
			["set-cookie", "session=abc"],
			["www-authenticate", "Bearer"],
		]);
		mockFetch({
			ok: true,
			status: 200,
			headers,
			text: async () => JSON.stringify({ ok: true }),
		});
		const result = await makeApiRequest("https://example.com/test", { method: "GET" });
		assert.strictEqual(result.ok, true);
		assert.ok(result.headers);
		assert.strictEqual(result.headers["x-test-header"], "test-value");
		assert.strictEqual(result.headers["set-cookie"], undefined);
		assert.strictEqual(result.headers["www-authenticate"], undefined);
	});

	it("handles 404 responses", async () => {
		mockFetch({
			ok: false,
			status: 404,
			headers: new Map([["content-type", "application/json"]]),
			text: async () => JSON.stringify({ error: "Not found" }),
		});
		const result = await makeApiRequest("https://example.com/nonexistent", { method: "GET" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.status, 404);
	});
});
