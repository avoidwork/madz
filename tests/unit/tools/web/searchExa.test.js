import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { searchWithExa, detectSearchBackend } from "../../../../src/tools/web/index.js";

describe("searchWithExa", () => {
	it("builds the correct request shape (POST, x-api-key header, body)", async () => {
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
			const result = await searchWithExa("test-key", "hello world", 5);
			assert.strictEqual(capturedUrl, "https://api.exa.ai/search");
			assert.strictEqual(capturedInit.method, "POST");
			assert.strictEqual(capturedInit.headers["x-api-key"], "test-key");
			assert.strictEqual(capturedInit.headers["Content-Type"], "application/json");
			const body = JSON.parse(capturedInit.body);
			assert.strictEqual(body.query, "hello world");
			assert.strictEqual(body.type, "auto");
			assert.strictEqual(body.numResults, 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("maps results[].text to description", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{ title: "Result 1", url: "https://example.com/1", text: "First snippet" },
					{ title: "Result 2", url: "https://example.com/2", text: "Second snippet" },
				],
			}),
		}));
		try {
			const result = await searchWithExa("test-key", "query", 5);
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

	it("maps results[].highlights[0] to description when text is absent", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{ title: "Result 1", url: "https://example.com/1", highlights: ["Highlight snippet"] },
				],
			}),
		}));
		try {
			const result = await searchWithExa("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.results[0].description, "Highlight snippet");
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
			const result = await searchWithExa("bad-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /401/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error on a 402 response", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 402,
			text: async () => "Payment required",
		}));
		try {
			const result = await searchWithExa("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /402/);
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
			const result = await searchWithExa("test-key", "query", 5);
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
			const result = await searchWithExa("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Exa search failed/);
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
			const result = await searchWithExa("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("clamps numResults to 1-100 in the request body", async () => {
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (_url, init) => {
			capturedInit = init;
			return { ok: true, status: 200, json: async () => ({ results: [] }) };
		});
		try {
			await searchWithExa("test-key", "query", 0);
			assert.strictEqual(JSON.parse(capturedInit.body).numResults, 1);
			await searchWithExa("test-key", "query", 500);
			assert.strictEqual(JSON.parse(capturedInit.body).numResults, 100);
		} finally {
			fetchMock.mock.restore();
		}
	});
});

describe("detectSearchBackend - exa", () => {
	it("returns exa when exa.apiKey is set", () => {
		assert.strictEqual(detectSearchBackend({ search: { exa: { apiKey: "test-key" } } }), "exa");
	});
});
