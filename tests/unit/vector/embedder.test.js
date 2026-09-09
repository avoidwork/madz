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
});
