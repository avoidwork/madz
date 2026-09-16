import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("searchCode tool", () => {
	let origFetch;
	let tmpDir;
	let dbPath;

	before(() => {
		origFetch = globalThis.fetch;
		tmpDir = mkdtempSync(join(process.cwd(), "tmp", "codesearch-"));
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

	async function seedData(path) {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const store = await createVectorStore(path);
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

	it("returns unknown project message when project not found", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5, project: "nonexistent" },
			{ vector: { projects: { madz: { dbPath } } }, openaiApiKey: "test-key" },
		);
		assert.ok(result.includes('Unknown project "nonexistent"'), `Got: ${result}`);
	});

	it("returns unknown project message when no projects configured", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{ vector: { projects: {} }, openaiApiKey: "test-key" },
		);
		assert.ok(result.includes("none configured"), `Got: ${result}`);
	});

	it("returns no matching code message when index is empty", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const emptyDb = join(tmpDir, "empty.db");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{
				vector: { projects: { test: { dbPath: emptyDb } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("No matching code found"), `Got: ${result}`);
	});

	it("returns formatted results from indexed data", async () => {
		await seedData(dbPath);
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{
				vector: { projects: { test: { dbPath } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("src/foo.js"), `Got: ${result}`);
		assert.ok(result.includes("distance:"), `Got: ${result}`);
	});

	it("filters results by fileFilter", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5, fileFilter: "src/foo*" },
			{
				vector: { projects: { test: { dbPath } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("src/foo.js"), `Got: ${result}`);
		assert.ok(!result.includes("src/bar.js"), `Got: ${result}`);
	});

	it("returns no results message when fileFilter excludes everything", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5, fileFilter: "nonexistent/*" },
			{
				vector: { projects: { test: { dbPath } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("No results matching filter"), `Got: ${result}`);
	});

	it("uses first project as default when no project specified", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{
				vector: { projects: { test: { dbPath } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("src/foo.js"), `Got: ${result}`);
	});

	it("handles store open failure gracefully", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{
				vector: { projects: { test: { dbPath: "/nonexistent/dir/db.sqlite" } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("Failed to open vector store"), `Got: ${result}`);
	});

	it("handles embed failure gracefully", async () => {
		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "hello", topK: 5 },
			{
				vector: { projects: { test: { dbPath } }, model: "openai" },
				// No openaiApiKey — will fail
			},
		);
		assert.ok(result.includes("Failed to embed query"), `Got: ${result}`);
	});

	it("fulltext mode returns FTS results with rank", async () => {
		// Seed with fulltext-enabled store
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const ftsDb = join(tmpDir, "fts-test.db");
		const ftsStore = await createVectorStore(ftsDb, { fulltext: true });
		await ftsStore.init();
		ftsStore.insertChunks([
			{
				filePath: "src/hello.js",
				lineStart: 1,
				lineEnd: 10,
				content: "function hello() { return 42; }",
				embedding: new Float32Array(384).fill(0.1),
			},
			{
				filePath: "src/debian.js",
				lineStart: 1,
				lineEnd: 5,
				content: "const debian = require('debian');",
				embedding: new Float32Array(384).fill(0.5),
			},
		]);
		ftsStore.close();

		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "debian", topK: 5, mode: "fulltext" },
			{
				vector: { projects: { test: { dbPath: ftsDb, fulltext: true } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("src/debian.js"), `Got: ${result}`);
		assert.ok(result.includes("rank:"), `Got: ${result}`);
	});

	it("hybrid mode returns combined results with source annotation", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const hybridDb = join(tmpDir, "hybrid-test.db");
		const hybridStore = await createVectorStore(hybridDb, { fulltext: true });
		await hybridStore.init();
		hybridStore.insertChunks([
			{
				filePath: "src/hello.js",
				lineStart: 1,
				lineEnd: 10,
				content: "function hello() { return 42; }",
				embedding: new Float32Array(384).fill(0.1),
			},
			{
				filePath: "src/debian.js",
				lineStart: 1,
				lineEnd: 5,
				content: "const debian = require('debian');",
				embedding: new Float32Array(384).fill(0.9),
			},
		]);
		hybridStore.close();

		const { searchCodeImpl } = await import("../../../src/tools/code/searchCode.js");
		const result = await searchCodeImpl(
			{ query: "debian", topK: 5, mode: "hybrid" },
			{
				vector: { projects: { test: { dbPath: hybridDb, fulltext: true } }, model: "openai" },
				openaiApiKey: "test-key",
			},
		);
		assert.ok(result.includes("source:"), `Got: ${result}`);
	});
});
