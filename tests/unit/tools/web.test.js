import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { detectSearchBackend, searchWebImpl } from "../../../src/tools/web/index.js";

describe("detectSearchBackend", () => {
	it("returns duckduckgo when no config is provided", () => {
		assert.strictEqual(detectSearchBackend({}), "duckduckgo");
	});

	it("returns duckduckgo when no search config is provided", () => {
		assert.strictEqual(detectSearchBackend({ search: {} }), "duckduckgo");
	});

	it("returns custom when custom.url is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { custom: { url: "https://example.com/search" } } }),
			"custom",
		);
	});

	it("returns bing when bing.apiKey is set", () => {
		assert.strictEqual(detectSearchBackend({ search: { bing: { apiKey: "test-key" } } }), "bing");
	});

	it("returns searxng when searxng.url is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { searxng: { url: "https://searxng.example.com" } } }),
			"searxng",
		);
	});

	it("returns bing when engine is explicitly set to bing", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "bing" } }), "bing");
	});

	it("returns duckduckgo when engine is explicitly set to duckduckgo", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "duckduckgo" } }), "duckduckgo");
	});

	it("honors explicit engine over configured credentials", () => {
		assert.strictEqual(
			detectSearchBackend({
				search: { engine: "duckduckgo", bing: { apiKey: "test-key" } },
			}),
			"duckduckgo",
		);
	});

	it("honors explicit engine over custom.url", () => {
		assert.strictEqual(
			detectSearchBackend({
				search: { engine: "custom", custom: { url: "https://example.com/search" } },
			}),
			"custom",
		);
	});

	it("falls back to inference chain when engine is set to an unsupported value", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "exa" } }), "duckduckgo");
	});

	it("falls back to inference chain when engine is set to an unsupported value but bing is configured", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { engine: "exa", bing: { apiKey: "test-key" } } }),
			"bing",
		);
	});
});

describe("searchWebImpl", () => {
	it("returns an error for an empty query", async () => {
		const result = await searchWebImpl({ query: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Query is required/);
	});

	it("returns an error when the query is not a string", async () => {
		const result = await searchWebImpl({ query: 123 });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Query is required/);
	});

	it("passes duckduckgo config params to the search URL", async () => {
		let capturedUrl;
		const fetchMock = mock.method(globalThis, "fetch", async (url) => {
			capturedUrl = url;
			return {
				ok: true,
				status: 200,
				text: async () =>
					'<a rel="nofollow" class="result__a" href="https://example.com">Example</a><a class="result__snippet" href="https://example.com">A description</a>',
			};
		});
		try {
			const result = await searchWebImpl(
				{ query: "test", limit: 5 },
				{
					search: {
						engine: "duckduckgo",
						duckduckgo: {
							region: "ca-en",
							safeSearch: "2",
							time: "w",
							baseUrl: "https://html.duckduckgo.com/html/",
						},
					},
				},
			);
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.backend, "duckduckgo");
			assert.strictEqual(capturedUrl.searchParams.get("kl"), "ca-en");
			assert.strictEqual(capturedUrl.searchParams.get("safe"), "2");
			assert.strictEqual(capturedUrl.searchParams.get("df"), "w");
		} finally {
			fetchMock.mock.restore();
		}
	});
});
