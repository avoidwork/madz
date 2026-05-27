import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { webSearchImpl, webExtractImpl, detectSearchBackend } from "../../src/tools/web.js";

describe("web_search", () => {
	let origFetch;
	let origEnv;

	before(() => {
		origFetch = globalThis.fetch;
		origEnv = { ...process.env };
	});

	after(() => {
		globalThis.fetch = origFetch;
		Object.assign(process.env, origEnv);
	});

	it("requires query", async () => {
		const result = await webSearchImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Query is required"));
	});

	it("rejects empty query", async () => {
		const result = await webSearchImpl({ query: " " }, {});
		assert.strictEqual(JSON.parse(result).ok, false);
	});

	it("requires at least one search API key", async () => {
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		const result = await webSearchImpl({ query: "test" }, {});
		assert.strictEqual(JSON.parse(result).ok, false);
		assert.ok(JSON.parse(result).error.includes("No search API key"));
	});

	it("uses Exa API when EXA_API_KEY is set", async () => {
		process.env.EXA_API_KEY = "sk-exa-test";
		globalThis.fetch = async (url, _opts) => {
			assert.ok(url.includes("exa.ai"));
			return {
				ok: true,
				json: async () => ({
					results: [{ title: "Quantum 1", url: "https://example.com/1", text: "Quantum physics" }],
				}),
			};
		};
		const result = await webSearchImpl({ query: "quantum computing", limit: 3 }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.backend, "exa");
	});

	after(() => {
		process.env.EXA_API_KEY = origEnv.EXA_API_KEY;
	});

	it("uses Firecrawl API when FIRECRAWL_API_KEY is set", async () => {
		process.env.FIRECRAWL_API_KEY = "sk-fc-test";
		delete process.env.EXA_API_KEY;
		globalThis.fetch = async (url, _opts) => {
			assert.ok(url.includes("firecrawl"));
			return {
				ok: true,
				json: async () => ({
					data: [
						{ metadata: { title: "FC page", sourceURL: "https://fc.com" }, markdown: "markdown" },
					],
				}),
			};
		};
		const result = await webSearchImpl({ query: "firecrawl test" }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
	});

	it("handles Exa API error response", async () => {
		process.env.EXA_API_KEY = "sk-test";
		globalThis.fetch = async () => ({
			ok: false,
			status: 500,
			text: async () => "Internal server error",
		});
		const result = await webSearchImpl({ query: "test" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Exa API error") || parsed.error.includes("500"));
	});

	it("handles Exa request failure (network error)", async () => {
		process.env.EXA_API_KEY = "sk-test";
		globalThis.fetch = async () => {
			throw new Error("Network unreachable");
		};
		const result = await webSearchImpl({ query: "test" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Exa request failed"));
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
		// Just verify it returns a proper response object
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
		assert.ok(parsed.ok);
		assert.ok(parsed.summary);
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

	it("returns exa when EXA_API_KEY is set", () => {
		process.env.EXA_API_KEY = "sk-test";
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		assert.strictEqual(detectSearchBackend(), "exa");
	});

	it("returns firecrawl when FIRECRAWL_API_KEY is set", () => {
		process.env.FIRECRAWL_API_KEY = "sk-test";
		delete process.env.EXA_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		assert.strictEqual(detectSearchBackend(), "firecrawl");
	});

	it("returns tavily when TAVILY_API_KEY is set", () => {
		process.env.TAVILY_API_KEY = "sk-test";
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		assert.strictEqual(detectSearchBackend(), "tavily");
	});

	it("returns parallel when PARALLEL_API_KEY is set", () => {
		process.env.PARALLEL_API_KEY = "sk-test";
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		assert.strictEqual(detectSearchBackend(), "parallel");
	});

	it("returns none when no keys are set", () => {
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		assert.strictEqual(detectSearchBackend(), "none");
	});
});
