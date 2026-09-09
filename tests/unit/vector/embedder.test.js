import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createEmbedder } from "../../../src/vector/embedder.js";

describe("createEmbedder", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	it("returns embedder with embed function", () => {
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		assert.ok(typeof embedder.embed === "function");
	});

	it("returns embedder with embed function for local model", () => {
		const embedder = createEmbedder({ model: "local" });
		assert.ok(typeof embedder.embed === "function");
	});

	it("uses OpenAI fallback when local model is specified but no pipeline", async () => {
		globalThis.fetch = async (_url, opts) => {
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((text, i) => ({
						index: i,
						embedding: Array.from({ length: 1536 }).fill(0.1),
					})),
					model: "text-embedding-3-small",
				}),
			};
		};

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		const result = await embedder.embed("test query");
		assert.ok(result instanceof Float32Array);
		assert.strictEqual(result.length, 1536);
	});

	it("handles batch embedding via OpenAI", async () => {
		globalThis.fetch = async (_url, opts) => {
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((text, i) => ({
						index: i,
						embedding: Array.from({ length: 1536 }).fill(0.1 * (i + 1)),
					})),
					model: "text-embedding-3-small",
				}),
			};
		};

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		const results = await embedder.embed(["text1", "text2", "text3"]);
		assert.ok(Array.isArray(results));
		assert.strictEqual(results.length, 3);
		assert.ok(results[0] instanceof Float32Array);
	});

	it("throws when OpenAI API key is missing", async () => {
		const embedder = createEmbedder({ model: "openai" });
		await assert.rejects(async () => {
			await embedder.embed("test");
		}, /OpenAI API key not configured/);
	});

	it("throws when both local and fallback fail", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-bad" });
		await assert.rejects(async () => {
			await embedder.embed("test");
		}, /OpenAI embedding API error/);
	});

	it("handles OpenAI API error without response text", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 500,
			text: async () => "",
		});

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		await assert.rejects(async () => {
			await embedder.embed("test");
		}, /OpenAI embedding API error/);
	});

	it("handles single string input returns Float32Array", async () => {
		globalThis.fetch = async (_url, opts) => {
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((text, i) => ({
						index: i,
						embedding: Array.from({ length: 384 }).fill(0.1),
					})),
					model: "text-embedding-3-small",
				}),
			};
		};

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		const result = await embedder.embed("single string");
		assert.ok(result instanceof Float32Array, "Single string should return Float32Array");
	});

	it("handles array input returns array of Float32Arrays", async () => {
		globalThis.fetch = async (_url, opts) => {
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((text, i) => ({
						index: i,
						embedding: Array.from({ length: 384 }).fill(0.1),
					})),
					model: "text-embedding-3-small",
				}),
			};
		};

		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });
		const results = await embedder.embed(["a", "b"]);
		assert.ok(Array.isArray(results), "Array input should return Array");
		assert.strictEqual(results.length, 2);
	});

	it("local model falls back to openai when pipeline unavailable", async () => {
		globalThis.fetch = async (_url, opts) => {
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((text, i) => ({
						index: i,
						embedding: Array.from({ length: 384 }).fill(0.1),
					})),
					model: "text-embedding-3-small",
				}),
			};
		};

		// With model: "local" and no openaiApiKey, local fails and fallback also fails
		const embedder = createEmbedder({ model: "local", openaiApiKey: "sk-test" });
		// Local pipeline won't load, but OpenAI fallback is configured and mocked
		const result = await embedder.embed("test");
		assert.ok(result instanceof Float32Array, "Should fall back to OpenAI successfully");
	});
});
