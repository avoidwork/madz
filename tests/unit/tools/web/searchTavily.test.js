import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { searchWithTavily, detectSearchBackend } from "../../../../src/tools/web/index.js";

describe("searchWithTavily", () => {
	it("builds the correct request shape (POST, Bearer auth, body)", async () => {
		let capturedUrl;
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
			capturedUrl = url;
			capturedInit = init;
			return {
				ok: true,
				status: 200,
				json: async () => ({ results: [] }),
			};
		});
		try {
			const result = await searchWithTavily("test-key", "hello world", 5);
			assert.strictEqual(capturedUrl, "https://api.tavily.com/search");
			assert.strictEqual(capturedInit.method, "POST");
			assert.strictEqual(capturedInit.headers.Authorization, "Bearer test-key");
			assert.strictEqual(capturedInit.headers["Content-Type"], "application/json");
			const body = JSON.parse(capturedInit.body);
			assert.strictEqual(body.query, "hello world");
			assert.strictEqual(body.search_depth, "basic");
			assert.strictEqual(body.max_results, 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("maps results[].content to description", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{ title: "Result 1", url: "https://example.com/1", content: "First snippet" },
					{ title: "Result 2", url: "https://example.com/2", content: "Second snippet" },
				],
			}),
		}));
		try {
			const result = await searchWithTavily("test-key", "query", 5);
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
			const result = await searchWithTavily("bad-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /401/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error on a 429 response", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 429,
			text: async () => "Rate limited",
		}));
		try {
			const result = await searchWithTavily("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /429/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error when the fetch throws", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			throw new Error("Network failure");
		});
		try {
			const result = await searchWithTavily("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Tavily search failed/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns empty results when the API returns no results", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ results: [] }),
		}));
		try {
			const result = await searchWithTavily("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("clamps max_results to 1-100 in the request body", async () => {
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (_url, init) => {
			capturedInit = init;
			return { ok: true, status: 200, json: async () => ({ results: [] }) };
		});
		try {
			await searchWithTavily("test-key", "query", 0);
			assert.strictEqual(JSON.parse(capturedInit.body).max_results, 1);
			await searchWithTavily("test-key", "query", 500);
			assert.strictEqual(JSON.parse(capturedInit.body).max_results, 100);
		} finally {
			fetchMock.mock.restore();
		}
	});
});

describe("detectSearchBackend - tavily", () => {
	it("returns tavily when engine is explicitly set to tavily", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "tavily" } }), "tavily");
	});

	it("returns tavily when tavily.apiKey is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { tavily: { apiKey: "test-key" } } }),
			"tavily",
		);
	});

	it("honors explicit engine over tavily credentials", () => {
		assert.strictEqual(
			detectSearchBackend({
				search: { engine: "duckduckgo", tavily: { apiKey: "test-key" } },
			}),
			"duckduckgo",
		);
	});

	it("falls back to inference chain when engine is unsupported but tavily is configured", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { engine: "exa", tavily: { apiKey: "test-key" } } }),
			"tavily",
		);
	});
});
