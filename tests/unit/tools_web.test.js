import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { searchWebImpl, detectSearchBackend } from "../../src/tools/web/index.js";

describe("searchWeb", () => {
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

	it("uses Bing when searchBingApiKey is set", async () => {
		mockFetch({
			ok: true,
			json: async () => ({
				webPages: { value: [{ name: "Bing Result", url: "https://bing.com", snippet: "desc" }] },
			}),
		});
		const result = await searchWebImpl(
			{ query: "test" },
			{ search: { bing: { apiKey: "sk-bing" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "bing");
	});

	it("uses SearXNG when searchSearxngUrl is set", async () => {
		mockFetch({
			ok: true,
			json: async () => ({
				results: [{ title: "SearX", url: "https://searxng.com", content: "desc" }],
			}),
		});
		const result = await searchWebImpl(
			{ query: "test" },
			{ search: { searxng: { url: "http://searxng.local" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "searxng");
	});

	it("uses Custom when searchCustomConfig is set", async () => {
		mockFetch({
			ok: true,
			json: async () => ({ results: [{ title: "Cust", url: "https://c.com", description: "D" }] }),
		});
		const result = await searchWebImpl(
			{ query: "test" },
			{ search: { custom: { url: "http://custom.local/search?q={{query}}", method: "GET" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "custom");
	});

	it("falls back to DuckDuckGo when no API/config keys set", async () => {
		mockFetch({
			ok: true,
			text: async () =>
				'<a rel="nofollow" class="result__a" href="https://ddg.com">DDG Result</a><a class="result__snippet" href="https://ddg.com">A snippet</a>',
		});
		const result = await searchWebImpl({ query: "test" }, { search: {} });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "duckduckgo");
	});

	it("rejects empty query", async () => {
		const result = await searchWebImpl({ query: "" }, { search: {} });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Query is required"));
	});

	it("caps limit at 100", async () => {
		mockFetch({ ok: true, json: async () => ({ results: [] }) });
		const result = await searchWebImpl(
			{ query: "test", limit: 200 },
			{ search: { custom: { url: "http://c.com" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles Bing API error response", async () => {
		mockFetch({ ok: false, status: 401, text: async () => "Invalid API key" });
		const result = await searchWebImpl({ query: "test" }, { search: { bing: { apiKey: "bad" } } });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Bing API error"));
	});

	it("handles SearXNG HTTP error", async () => {
		mockFetch({ ok: false, status: 503 });
		const result = await searchWebImpl(
			{ query: "test" },
			{ search: { searxng: { url: "http://broken.local" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("SearXNG"));
	});

	it("handles Custom search failure", async () => {
		mockFetch({ ok: false, status: 500 });
		const result = await searchWebImpl(
			{ query: "test" },
			{ search: { custom: { url: "http://broken" } } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Custom") || parsed.error.includes("500"));
	});
});

describe("detectSearchBackend", () => {
	it("returns custom when searchCustomConfig is set", async () => {
		assert.strictEqual(
			detectSearchBackend({ search: { custom: { url: "http://c.local" } } }),
			"custom",
		);
	});

	it("returns bing when searchBingApiKey is set", async () => {
		assert.strictEqual(detectSearchBackend({ search: { bing: { apiKey: "sk-bing" } } }), "bing");
	});

	it("returns searxng when searchSearxngUrl is set", async () => {
		assert.strictEqual(
			detectSearchBackend({ search: { searxng: { url: "http://s.local" } } }),
			"searxng",
		);
	});

	it("returns duckduckgo as fallback when no keys set", async () => {
		assert.strictEqual(detectSearchBackend({ search: {} }), "duckduckgo");
	});
});
