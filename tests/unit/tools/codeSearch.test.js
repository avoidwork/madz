import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("codeSearch tool", () => {
	let origFetch;
	let tmpDir;
	let dbPath;

	before(() => {
		origFetch = globalThis.fetch;
		tmpDir = mkdtempSync(join(tmpdir(), "codesearch-"));
		dbPath = join(tmpDir, "vector.db");

		// Mock OpenAI embedding API before any module imports
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
			return origFetch ? origFetch(url, opts) : fetch(url, opts);
		};
	});

	after(() => {
		globalThis.fetch = origFetch;
		if (tmpDir) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	async function seedData() {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const store = await createVectorStore(dbPath);
		await store.init();
		store.insertChunks([
			{
				filePath: "src/foo.js",
				lineStart: 1,
				lineEnd: 10,
				content: "function hello() { return 42; }",
				embedding: new Float32Array(384).fill(0.1),
			},
			{
				filePath: "src/bar.js",
				lineStart: 20,
				lineEnd: 30,
				content: 'function goodbye() { return "bye"; }',
				embedding: new Float32Array(384).fill(0.5),
			},
		]);
		store.close();
	}

	it("returns no results message when index is empty", async () => {
		const { codeSearchImpl } = await import("../../../src/tools/codeSearch/index.js");
		const emptyDb = join(tmpDir, "empty.db");
		const result = await codeSearchImpl(
			{ query: "hello", topK: 5 },
			{ vector: { dbPath: emptyDb, model: "openai" }, openaiApiKey: "test-key" },
		);
		assert.ok(result.includes("No matching code found"), `Got: ${result}`);
	});

	it("returns formatted results from indexed data", async () => {
		await seedData();
		const { codeSearchImpl } = await import("../../../src/tools/codeSearch/index.js");
		const result = await codeSearchImpl(
			{ query: "hello", topK: 5 },
			{ vector: { dbPath, model: "openai" }, openaiApiKey: "test-key" },
		);
		assert.ok(result.includes("src/foo.js"), `Got: ${result}`);
		assert.ok(result.includes("distance:"), `Got: ${result}`);
	});

	it("filters results by fileFilter", async () => {
		const { codeSearchImpl } = await import("../../../src/tools/codeSearch/index.js");
		const result = await codeSearchImpl(
			{ query: "hello", topK: 5, fileFilter: "src/foo*" },
			{ vector: { dbPath, model: "openai" }, openaiApiKey: "test-key" },
		);
		assert.ok(result.includes("src/foo.js"), `Got: ${result}`);
		assert.ok(!result.includes("src/bar.js"), `Got: ${result}`);
	});
});
