import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { webSearchImpl, webExtractImpl, detectSearchBackend } from "../../src/tools/web.js";

describe("web_search", () => {
	let origFetch, origEnv;

	before(() => {
		origFetch = globalThis.fetch;
		origEnv = { ...process.env };
	});

	after(() => {
		globalThis.fetch = origFetch;
		Object.assign(process.env, origEnv);
	});

	afterEach(() => {
		delete process.env.SEARXNG_URL;
		delete process.env.BING_API_KEY;
		delete process.env.CUSTOM_SEARCH_URL;
	});

	let _saved = {};
	function setEnv(vars) {
		_saved = { ...process.env };
		for (const [k, v] of Object.entries(vars || {})) {
			if (v === undefined) {
				delete process.env[k];
			} else {
				process.env[k] = v;
			}
		}
	}

	function mockFetch(resp) {
		globalThis.fetch = async (_url, _opts) => resp;
	}

	it("uses Bing when BING_API_KEY is set", async () => {
		setEnv({ BING_API_KEY: "sk-bing", SEARXNG_URL: undefined, CUSTOM_SEARCH_URL: undefined });
		assert.strictEqual(detectSearchBackend(), "bing");
		mockFetch({
			ok: true,
			json: async () => ({
				webPages: { value: [{ name: "Bing Result", url: "https://bing.com", snippet: "desc" }] },
			}),
		});
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "bing");
	});

	it("uses SearXNG when SEARXNG_URL is set", async () => {
		setEnv({
			BING_API_KEY: undefined,
			SEARXNG_URL: "http://searxng.local",
			CUSTOM_SEARCH_URL: undefined,
		});
		assert.strictEqual(detectSearchBackend(), "searxng");
		mockFetch({
			ok: true,
			json: async () => ({
				results: [{ title: "SearX", url: "https://searxng.com", content: "desc" }],
			}),
		});
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "searxng");
	});

	it("uses Custom when CUSTOM_SEARCH_URL is set", async () => {
		setEnv({
			BING_API_KEY: undefined,
			SEARXNG_URL: undefined,
			CUSTOM_SEARCH_URL: "http://custom.local/search?q={{query}}",
			CUSTOM_SEARCH_BODY: '{ "q": "{{query}}" }',
		});
		assert.strictEqual(detectSearchBackend(), "custom");
		mockFetch({
			ok: true,
			json: async () => ({ results: [{ title: "Cust", url: "https://c.com", description: "D" }] }),
		});
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "custom");
	});

	it("falls back to DuckDuckGo when no API/config keys set", async () => {
		setEnv({
			BING_API_KEY: undefined,
			SEARXNG_URL: undefined,
			CUSTOM_SEARCH_URL: undefined,
		});
		assert.strictEqual(detectSearchBackend(), "duckduckgo");
		mockFetch({
			ok: true,
			text: async () =>
				'<a rel="nofollow" class="result__a" href="https://ddg.com">DDG Result</a><a class="result__snippet" href="https://ddg.com">A snippet</a>',
		});
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.backend, "duckduckgo");
	});

	it("rejects empty query", async () => {
		const result = await webSearchImpl({ query: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Query is required"));
	});

	it("caps limit at 100", async () => {
		setEnv({ CUSTOM_SEARCH_URL: "http://c.com" });
		assert.strictEqual(detectSearchBackend(), "custom");
		mockFetch({ ok: true, json: async () => ({ results: [] }) });
		const result = await webSearchImpl({ query: "test", limit: 200 });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles Bing API error response", async () => {
		setEnv({ BING_API_KEY: "bad", SEARXNG_URL: undefined, CUSTOM_SEARCH_URL: undefined });
		mockFetch({ ok: false, status: 401, text: async () => "Invalid API key" });
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Bing API error"));
	});

	it("handles SearXNG HTTP error", async () => {
		setEnv({
			BING_API_KEY: undefined,
			SEARXNG_URL: "http://broken.local",
			CUSTOM_SEARCH_URL: undefined,
		});
		mockFetch({ ok: false, status: 503 });
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("SearXNG"));
	});

	it("handles Custom search failure", async () => {
		setEnv({ BING_API_KEY: undefined, SEARXNG_URL: undefined, CUSTOM_SEARCH_URL: "http://broken" });
		mockFetch({ ok: false, status: 500 });
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Custom") || parsed.error.includes("500"));
	});
});

describe("web_extract", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	it("requires URL", async () => {
		const result = await webExtractImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("URL is required"));
	});

	it("rejects invalid URL format via filterUrl", async () => {
		const result = await webExtractImpl({ url: "not-a-url" }, {});
		const parsed = JSON.parse(result);
		assert.ok("ok" in parsed);
	});

	it("handles HTTP error response", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 404,
			statusText: "Not Found",
		});
		const result = await webExtractImpl({ url: "https://example.com/notfound" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("HTTP 404") || parsed.error.includes("404"));
	});

	it("handles fetch failure", async () => {
		globalThis.fetch = async () => {
			throw new Error("Network error");
		};
		const result = await webExtractImpl({ url: "https://example.com" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Fetch failed"));
	});

	it("handles short page content", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "Short",
		});
		const result = await webExtractImpl({ url: "https://example.com" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("too short") || parsed.error.includes("unreadable"));
	});

	it("handles large page with summarizeLarge", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "<html><body>" + "x".repeat(12000) + "</body></html>",
		});
		const result = await webExtractImpl({ url: "https://example.com", summarizeLarge: true }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.content);
	});
});

describe("detectSearchBackend", () => {
	let origEnv;

	beforeEach(() => {
		origEnv = { ...process.env };
	});

	afterEach(() => {
		Object.assign(process.env, origEnv);
	});

	it("returns custom when CUSTOM_SEARCH_URL is set", () => {
		process.env.CUSTOM_SEARCH_URL = "http://c.local";
		delete process.env.BING_API_KEY;
		delete process.env.SEARXNG_URL;
		assert.strictEqual(detectSearchBackend(), "custom");
	});

	it("returns bing when BING_API_KEY is set", () => {
		process.env.BING_API_KEY = "sk-bing";
		delete process.env.CUSTOM_SEARCH_URL;
		delete process.env.SEARXNG_URL;
		assert.strictEqual(detectSearchBackend(), "bing");
	});

	it("returns searxng when SEARXNG_URL is set", () => {
		process.env.SEARXNG_URL = "http://s.local";
		delete process.env.BING_API_KEY;
		delete process.env.CUSTOM_SEARCH_URL;
		assert.strictEqual(detectSearchBackend(), "searxng");
	});

	it("returns duckduckgo as fallback when no keys set", () => {
		delete process.env.CUSTOM_SEARCH_URL;
		delete process.env.BING_API_KEY;
		delete process.env.SEARXNG_URL;
		assert.strictEqual(detectSearchBackend(), "duckduckgo");
	});
});
