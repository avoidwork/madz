import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { searchWithBrave, detectSearchBackend } from "../../../../src/tools/web/index.js";

describe("searchWithBrave", () => {
	it("builds the correct request shape (GET, X-Subscription-Token, params)", async () => {
		let capturedUrl;
		let capturedInit;
		const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
			capturedUrl = url;
			capturedInit = init;
			return {
				ok: true,
				status: 200,
				json: async () => ({ web: { results: [] } }),
			};
		});
		try {
			const result = await searchWithBrave("test-key", "hello world", 5);
			assert.strictEqual(
				capturedUrl.toString(),
				"https://api.search.brave.com/res/v1/web/search?q=hello+world&count=5",
			);
			assert.strictEqual(capturedInit.method, "GET");
			assert.strictEqual(capturedInit.headers["X-Subscription-Token"], "test-key");
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("maps web.results[].description to description", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				web: {
					results: [
						{ title: "Result 1", url: "https://example.com/1", description: "First snippet" },
						{ title: "Result 2", url: "https://example.com/2", description: "Second snippet" },
					],
				},
			}),
		}));
		try {
			const result = await searchWithBrave("test-key", "query", 5);
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
			const result = await searchWithBrave("bad-key", "query", 5);
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
			const result = await searchWithBrave("test-key", "query", 5);
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
			const result = await searchWithBrave("test-key", "query", 5);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /Brave search failed/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns empty results when the API returns no results", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ web: { results: [] } }),
		}));
		try {
			const result = await searchWithBrave("test-key", "query", 5);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.results, []);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("clamps count to 1-100 in the request params", async () => {
		let capturedUrl;
		const fetchMock = mock.method(globalThis, "fetch", async (url) => {
			capturedUrl = url;
			return { ok: true, status: 200, json: async () => ({ web: { results: [] } }) };
		});
		try {
			await searchWithBrave("test-key", "query", 0);
			assert.match(capturedUrl.toString(), /count=1/);
			await searchWithBrave("test-key", "query", 500);
			assert.match(capturedUrl.toString(), /count=100/);
		} finally {
			fetchMock.mock.restore();
		}
	});
});

describe("detectSearchBackend - brave", () => {
	it("returns brave when brave.apiKey is set", () => {
		assert.strictEqual(detectSearchBackend({ search: { brave: { apiKey: "test-key" } } }), "brave");
	});
});
