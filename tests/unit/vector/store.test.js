import { describe, it, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createVectorStore } from "../../../src/vector/store.js";

describe("createVectorStore", () => {
	/** @type {import("../../../src/vector/store.js").VectorStore} */
	let store;

	after(async () => {
		if (store) {
			store.close();
		}
	});

	it("creates store and initializes schema", async () => {
		store = await createVectorStore(":memory:");
		await store.init();
		assert.ok(store);
		assert.ok(typeof store.insertChunks === "function");
		assert.ok(typeof store.search === "function");
		assert.ok(typeof store.removeFile === "function");
	});

	it("creates directory for file-based db", async () => {
		const tmpDir = mkdtempSync(join(process.cwd(), "tmp", "store-test-"));
		const dbPath = join(tmpDir, "subdir", "test.db");
		store = await createVectorStore(dbPath);
		await store.init();
		assert.ok(existsSync(join(tmpDir, "subdir")));
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("inserts chunks and searches them", async () => {
		store = await createVectorStore(":memory:");
		await store.init();

		store.insertChunks([
			{
				filePath: "test.js",
				lineStart: 1,
				lineEnd: 10,
				content: "function hello() { return 42; }",
				embedding: new Float32Array(384).fill(0.1),
			},
		]);

		const results = store.search(new Float32Array(384).fill(0.1), 5);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].filePath, "test.js");
		assert.strictEqual(results[0].lineStart, 1);
		assert.strictEqual(results[0].lineEnd, 10);
		assert.strictEqual(results[0].content, "function hello() { return 42; }");
		assert.ok(typeof results[0].distance === "number");
	});

	it("returns empty array when no matches", async () => {
		store = await createVectorStore(":memory:");
		await store.init();

		const results = store.search(new Float32Array(384).fill(0.5), 5);
		assert.strictEqual(results.length, 0);
	});

	it("removes chunks by file path", async () => {
		store = await createVectorStore(":memory:");
		await store.init();

		store.insertChunks([
			{
				filePath: "a.js",
				lineStart: 1,
				lineEnd: 10,
				content: "aaa",
				embedding: new Float32Array(384).fill(0.1),
			},
			{
				filePath: "b.js",
				lineStart: 1,
				lineEnd: 10,
				content: "bbb",
				embedding: new Float32Array(384).fill(0.2),
			},
		]);

		store.removeFile("a.js");
		const results = store.search(new Float32Array(384).fill(0.1), 10);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].filePath, "b.js");
	});

	it("respects topK parameter", async () => {
		store = await createVectorStore(":memory:");
		await store.init();

		for (let i = 0; i < 10; i++) {
			store.insertChunks([
				{
					filePath: `file${i}.js`,
					lineStart: 1,
					lineEnd: 5,
					content: `content ${i}`,
					embedding: new Float32Array(384).fill(0.01 * (i + 1)),
				},
			]);
		}

		const results = store.search(new Float32Array(384).fill(0.1), 3);
		assert.strictEqual(results.length, 3);
	});

	it("removeFile handles non-existent file gracefully", () => {
		// Should not throw when removing a file that doesn't exist
		store.removeFile("nonexistent.js");
	});

	it("close can be called multiple times", () => {
		store.close();
		store.close();
	});
});
