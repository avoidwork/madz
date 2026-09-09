import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createVectorStore } from "../../../src/vector/store.js";
import { createEmbedder } from "../../../src/vector/embedder.js";
import { reindex } from "../../../src/vector/indexer.js";

describe("vector full flow", () => {
	/** @type {string} */
	let tmpDir;
	/** @type {string} */
	let dbPath;
	/** @type {import("../../../src/vector/store.js").VectorStore} */
	let store;
	let origFetch;

	before(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "vector-int-"));
		dbPath = join(tmpDir, "vector.db");

		// Create a test project structure
		mkdirSync(join(tmpDir, "src"), { recursive: true });
		writeFileSync(
			join(tmpDir, "src", "math.js"),
			"function add(a, b) { return a + b; }\nfunction subtract(a, b) { return a - b; }\n",
		);
		writeFileSync(
			join(tmpDir, "src", "hello.js"),
			"function greet(name) { return `Hello, ${name}!`; }\n",
		);

		// Mock OpenAI for embedder fallback
		origFetch = globalThis.fetch;
		globalThis.fetch = async (url, opts) => {
			if (url === "https://api.openai.com/v1/embeddings") {
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
			}
			return origFetch(url, opts);
		};

		store = await createVectorStore(dbPath);
		await store.init();
	});

	after(() => {
		globalThis.fetch = origFetch;
		if (store) store.close();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("scans, chunks, embeds, stores, and queries source files", async () => {
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
		});

		assert.ok(result.indexed >= 2, `Expected at least 2 indexed files, got ${result.indexed}`);
		assert.strictEqual(result.errors, 0, `Expected 0 errors, got ${result.errors}`);

		// Query for something related to addition
		const queryEmbedding = embedder.embed("function that adds numbers");
		const searchResults = store.search(await queryEmbedding, 5);

		assert.ok(searchResults.length > 0, "Expected at least 1 search result");
		assert.ok(
			searchResults.some((r) => r.filePath.includes("math.js")),
			"Expected math.js in search results",
		);
	});

	it("skips unchanged files on re-index", async () => {
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
		});

		assert.strictEqual(result.indexed, 0, "Expected 0 newly indexed files on re-index");
		assert.ok(result.skipped > 0, "Expected files to be skipped on re-index");
	});
});
