import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { webSearchImpl, webExtractImpl, detectSearchBackend } from "../../src/tools/web.js";

describe("web_search", () => {
	let origFetch, origEnv;

	before(() => {
		origFetch = globalThis.fetch;
		origEnv = {
			EXA_API_KEY: process.env.EXA_API_KEY,
			FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
			TAVILY_API_KEY: process.env.TAVILY_API_KEY,
			PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
		};
	});

	after(() => {
		globalThis.fetch = origFetch;
		process.env.EXA_API_KEY = origEnv.EXA_API_KEY;
		process.env.FIRECRAWL_API_KEY = origEnv.FIRECRAWL_API_KEY;
		process.env.TAVILY_API_KEY = origEnv.TAVILY_API_KEY;
		process.env.PARALLEL_API_KEY = origEnv.PARALLEL_API_KEY;
	});

	function withEnv(overrides, fn) {
		const _saved = {
			EXA: process.env.EXA_API_KEY,
			FC: process.env.FIRECRAWL_API_KEY,
			TV: process.env.TAVILY_API_KEY,
			PAR: process.env.PARALLEL_API_KEY,
		};
		for (const [k, v] of Object.entries(overrides)) {
			if (v === undefined) {
				delete process.env[k];
			} else {
				process.env[k] = v;
			}
		}
		return fn();
	}

	function withMockFetch(mock, fn) {
		const orig = globalThis.fetch;
		globalThis.fetch = mock;
		return fn().finally(() => {
			globalThis.fetch = orig;
		});
	}

	it("uses Exa when EXA_API_KEY is set", async () => {
		await withEnv(
			{ EXA_API_KEY: "sk-exa", FIRECRAWL_API_KEY: undefined, TAVILY_API_KEY: undefined },
			async () => {
				assert.strictEqual(await detectSearchBackend(), "exa");
				return withMockFetch(
					async (url, _opts) => {
						assert.ok(url.includes("exa.ai"));
						return {
							ok: true,
							json: async () => ({
								results: [{ title: "Result 1", url: "https://example.com", text: "Desc" }],
							}),
						};
					},
					() => {
						return withMockFetch(
							async (url, opts) => {
								const body = JSON.parse(opts.body);
								assert.strictEqual(body.query, "test query");
								return {
									ok: true,
									json: async () => ({
										results: [{ title: "Result 1", url: "https://example.com", text: "Desc" }],
									}),
								};
							},
							async () => {
								const result = await webSearchImpl({ query: "test query" });
								const parsed = JSON.parse(result);
								assert.strictEqual(parsed.ok, true);
								assert.strictEqual(parsed.backend, "exa");
							},
						);
					},
				);
			},
		);
	});

	it("uses Firecrawl when FIRECRAWL_API_KEY is set", async () => {
		await withEnv(
			{ EXA_API_KEY: undefined, FIRECRAWL_API_KEY: "sk-fc", TAVILY_API_KEY: undefined },
			async () => {
				return withMockFetch(
					async () => ({
						ok: true,
						json: async () => ({
							data: [
								{
									metadata: { title: "FC Result", sourceURL: "https://fc.com" },
									markdown: "content",
								},
							],
						}),
					}),
					async () => {
						const result = await webSearchImpl({ query: "test" });
						const parsed = JSON.parse(result);
						assert.strictEqual(parsed.ok, true);
						assert.strictEqual(parsed.backend, "firecrawl");
					},
				);
			},
		);
	});

	it("uses Tavily when TAVILY_API_KEY is set", async () => {
		await withEnv(
			{ EXA_API_KEY: undefined, FIRECRAWL_API_KEY: undefined, TAVILY_API_KEY: "sk-tv" },
			async () => {
				return withMockFetch(
					async () => ({
						ok: true,
						json: async () => ({
							results: [{ title: "TV Result", url: "https://tv.com", content: "content" }],
						}),
					}),
					async () => {
						const result = await webSearchImpl({ query: "test" });
						const parsed = JSON.parse(result);
						assert.strictEqual(parsed.ok, true);
						assert.strictEqual(parsed.backend, "tavily");
					},
				);
			},
		);
	});

	it("uses Parallel as fallback when PARALLEL_API_KEY is set", async () => {
		await withEnv(
			{
				EXA_API_KEY: undefined,
				FIRECRAWL_API_KEY: undefined,
				TAVILY_API_KEY: undefined,
				PARALLEL_API_KEY: "sk-par",
			},
			async () => {
				return withMockFetch(
					async (url) => {
						assert.ok(url.includes("duckduckgo"));
						return {
							ok: true,
							text: async () =>
								`<a rel="nofollow" class="result__a" href="https://ddg.com?q=1">Test Result</a><a class="result__snippet" href="https://ddg.com">A snippet</a>`,
						};
					},
					async () => {
						const result = await webSearchImpl({ query: "test" });
						const parsed = JSON.parse(result);
						assert.strictEqual(parsed.ok, true);
						assert.strictEqual(parsed.backend, "parallel");
					},
				);
			},
		);
	});

	it("rejects empty query", async () => {
		const result = await webSearchImpl({ query: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Query is required"));
	});

	it("caps limit at 100", async () => {
		await withEnv(
			{ EXA_API_KEY: "sk-test", FIRECRAWL_API_KEY: undefined, TAVILY_API_KEY: undefined },
			async () => {
				return withMockFetch(
					async (url, opts) => {
						const body = JSON.parse(opts.body);
						assert.strictEqual(body.numResults, 5);
						return { ok: true, json: async () => ({ results: [] }) };
					},
					async () => {
						const result = await webSearchImpl({ query: "test", limit: 200 });
						const parsed = JSON.parse(result);
						assert.ok(parsed.ok);
					},
				);
			},
		);
	});

	it("returns descriptive error when no key configured", async () => {
		await withEnv(
			{
				EXA_API_KEY: undefined,
				FIRECRAWL_API_KEY: undefined,
				TAVILY_API_KEY: undefined,
				PARALLEL_API_KEY: undefined,
			},
			async () => {
				const result = await webSearchImpl({ query: "test" });
				const parsed = JSON.parse(result);
				assert.strictEqual(parsed.ok, false);
				assert.ok(parsed.error.includes("No search API key"));
			},
		);
	});

	it("returns error when Exa API fails", async () => {
		await withEnv({ EXA_API_KEY: "sk-test" }, async () => {
			return withMockFetch(
				async () => ({
					ok: false,
					status: 401,
					text: async () => "Invalid API key",
				}),
				async () => {
					const result = await webSearchImpl({ query: "test" });
					const parsed = JSON.parse(result);
					assert.strictEqual(parsed.ok, false);
					assert.ok(parsed.error.includes("Exa API error"));
				},
			);
		});
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

	it("returns error for blocked URL scheme (file://)", async () => {
		globalThis.fetch = async () => ({ ok: true, text: async () => "" });
		const result = await webExtractImpl({ url: "file:///etc/passwd" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("URL rejected"));
	});

	it("returns error for missing URL", async () => {
		const result = await webExtractImpl({ url: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("URL is required"));
	});

	it("extracts content from valid HTTP URL", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "<html><body><h1>Hello</h1><p>World</p></body></html>",
		});
		const result = await webExtractImpl({ url: "https://example.com/page" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.content.includes("Hello"));
		assert.ok(parsed.content.includes("World"));
		assert.strictEqual(parsed.url, "https://example.com/page");
	});

	it("returns summary for large pages when summarizeLarge is true", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => Array(5000).fill("<p>").join(""),
		});
		const result = await webExtractImpl({ url: "https://example.com/large", summarizeLarge: true });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.summary);
		assert.ok(parsed.content.includes("Large page"));
	});

	it("filters out script and style tags", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			text: async () => "<script>var x = 1;</script><style>body{}</style><p>visible content</p>",
		});
		const result = await webExtractImpl({ url: "https://example.com" });
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.ok(parsed.content.includes("visible content"));
		assert.ok(!parsed.content.includes("var x = 1"));
		assert.ok(!parsed.content.includes("body{}"));
	});

	it("filters out gopher scheme", async () => {
		globalThis.fetch = async () => {};
		const result = await webExtractImpl({ url: "gopher://example.com" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});
});
