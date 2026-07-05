import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import { webSearchImpl, webExtractImpl, detectSearchBackend } from "../../src/tools/web.js";

describe("webSearch", () => {
	let origFetch;
	let configMock;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
		configMock?.restore();
	});

	function mockFetch(resp) {
		globalThis.fetch = async (_url, _opts) => resp;
	}

	async function mockConfig(searchConfig) {
		configMock?.restore();
		configMock = mock.method(await import("../../src/config/loader.js"), "loadConfig", () => ({
			search: searchConfig || {},
			providers: {},
		}));
	}

	it("uses Bing when searchBingApiKey is set", async () => {
		mockConfig({ bing: { apiKey: "sk-bing" } });
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

	it("uses SearXNG when searchSearxngUrl is set", async () => {
		mockConfig({ searxng: { url: "http://searxng.local" } });
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

	it("uses Custom when searchCustomConfig is set", async () => {
		mockConfig({
			custom: {
				url: "http://custom.local/search?q={{query}}",
				method: "GET",
			},
		});
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
		mockConfig(null);
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
		mockConfig(null);
		const result = await webSearchImpl({ query: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Query is required"));
	});

	it("caps limit at 100", async () => {
		mockConfig({
			custom: { url: "http://c.com" },
		});
		mockFetch({ ok: true, json: async () => ({ results: [] }) });
		const result = await webSearchImpl({ query: "test", limit: 200 });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});

	it("handles Bing API error response", async () => {
		mockConfig({ bing: { apiKey: "bad" } });
		mockFetch({ ok: false, status: 401, text: async () => "Invalid API key" });
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Bing API error"));
	});

	it("handles SearXNG HTTP error", async () => {
		mockConfig({ searxng: { url: "http://broken.local" } });
		mockFetch({ ok: false, status: 503 });
		const result = await webSearchImpl({ query: "test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("SearXNG"));
	});

	it("handles Custom search failure", async () => {
		mockConfig({ custom: { url: "http://broken" } });
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
		const result = await webExtractImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("URL is required"));
	});

	it("rejects invalid URL format via filterUrl", async () => {
		const result = await webExtractImpl({ url: "not-a-url" });
		const parsed = JSON.parse(result);
		assert.ok("ok" in parsed);
	});

	it("handles HTTP error response", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 404,
			statusText: "Not Found",
		});
		const result = await webExtractImpl({ url: "https://example.com/notfound" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("HTTP 404") || parsed.error.includes("404"));
	});

	it("handles fetch failure", async () => {
		globalThis.fetch = async () => {
			throw new Error("Network error");
		};
		const result = await webExtractImpl({ url: "https://example.com" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Fetch failed"));
	});

	it("handles short page content", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "Short",
		});
		const result = await webExtractImpl({ url: "https://example.com" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("too short") || parsed.error.includes("unreadable"));
	});

	it("handles large page with summarizeLarge", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "<html><body>" + "x".repeat(12000) + "</body></html>",
		});
		const result = await webExtractImpl({ url: "https://example.com", summarizeLarge: true });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.content);
	});
});

describe("detectSearchBackend", () => {
	let configMock;

	after(() => {
		configMock?.restore();
	});

	it("returns custom when searchCustomConfig is set", async () => {
		configMock = mock.property(await import("../../src/config/loader.js"), "loadConfig", () => ({
			search: { custom: { url: "http://c.local" } },
			providers: {},
		}));
		assert.strictEqual(detectSearchBackend(), "custom");
	});

	it("returns bing when searchBingApiKey is set", async () => {
		configMock = mock.property(await import("../../src/config/loader.js"), "loadConfig", () => ({
			search: { bing: { apiKey: "sk-bing" } },
			providers: {},
		}));
		assert.strictEqual(detectSearchBackend(), "bing");
	});

	it("returns searxng when searchSearxngUrl is set", async () => {
		configMock = mock.property(await import("../../src/config/loader.js"), "loadConfig", () => ({
			search: { searxng: { url: "http://s.local" } },
			providers: {},
		}));
		assert.strictEqual(detectSearchBackend(), "searxng");
	});

	it("returns duckduckgo as fallback when no keys set", async () => {
		configMock = mock.property(await import("../../src/config/loader.js"), "loadConfig", () => ({
			search: {},
			providers: {},
		}));
		assert.strictEqual(detectSearchBackend(), "duckduckgo");
	});
});
