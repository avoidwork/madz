import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { searchWithFirecrawl, detectSearchBackend } from "../../../../src/tools/web/index.js";

describe("searchWithFirecrawl", () => {
	it("builds the correct request shape (POST, Bearer auth, body)", async () => {
		let capturedUrl;
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
			capturedUrl = url;
			capturedInit = init;
			return {
				ok: true,
				status: 200,
				json: async () => ({ web: [] }),
			};
		});
		try {
			const result = await searchWithFirecrawl("test-key", "hello world", 5);
			assert.strictEqual(capturedUrl, "https://api.firecrawl.dev/v2/search");
			assert.strictEqual(capturedInit.method, "POST");
			assert.strictEqual(capturedInit.headers.Authorization, "Bearer test-key");
			assert.strictEqual(capturedInit.headers["Content-Type"], "application/json");
			const body = JSON.parse(capturedInit.body);
			assert.strictEqual(body.query, "hello world");
			assert.strictEqual(body.limit, 5);
			assert.deepStrictEqual(body.sources, ["web"]);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("maps data.web[].description to description", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				web: [
					{ title: "Result 1", url: "https://example.com/1", description: "First snippet" },
					{ title: "Result 2", url: "https://example.com/2", description: "Second snippet" },
				],
			}),
		}));
		try {
			const result = await searchWithFirecrawl("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.results.length, 2);
			assert.strictEqual(result.results[0].title, "Result 1");
			assert.strictEqual(result.results[0].url, "https://example.com/1");
			assert.strictEqual(result.results[0].description, "First snippet");
			assert.strictEqual(result.results[1].description, "Second snippet");
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error on a 401 response", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		}));
		try {
			const result = await searchWithFirecrawl("bad-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /401/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error on a 408 response", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 408,
			text: async () => "Request timeout",
		}));
		try {
			const result = await searchWithFirecrawl("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /408/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error on a 500 response", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 500,
			text: async () => "Server error",
		}));
		try {
			const result = await searchWithFirecrawl("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /500/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error when the fetch throws", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			throw new Error("Network failure");
		});
		try {
			const result = await searchWithFirecrawl("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Firecrawl search failed/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns empty results when the API returns no results", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ web: [] }),
		}));
		try {
			const result = await searchWithFirecrawl("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("clamps limit to 1-100 in the request body", async () => {
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (_url, init) => {
			capturedInit = init;
			return { ok: true, status: 200, json: async () => ({ web: [] }) };
		});
		try {
			await searchWithFirecrawl("test-key", "query", 0);
			assert.strictEqual(JSON.parse(capturedInit.body).limit, 1);
			await searchWithFirecrawl("test-key", "query", 500);
			assert.strictEqual(JSON.parse(capturedInit.body).limit, 100);
		} finally {
			fetchMock.mock.restore();
		}
	});
});

describe("detectSearchBackend - firecrawl", () => {
	it("returns firecrawl when firecrawl.apiKey is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { firecrawl: { apiKey: "test-key" } } }),
			"firecrawl",
		);
	});
});
