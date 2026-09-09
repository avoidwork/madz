import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scanFiles } from "../../../src/vector/indexer.js";

describe("scanFiles", () => {
	/** @type {string} */
	let tmpDir;

	before(() => {
		tmpDir = mkdtempSync(join(process.cwd(), "tmp", "indexer-test-"));
		mkdirSync(join(tmpDir, "src"), { recursive: true });
		mkdirSync(join(tmpDir, "node_modules"), { recursive: true });
		mkdirSync(join(tmpDir, ".git"), { recursive: true });
		mkdirSync(join(tmpDir, "src", "utils"), { recursive: true });
		writeFileSync(join(tmpDir, "src", "foo.js"), "const x = 1;");
		writeFileSync(join(tmpDir, "src", "bar.mjs"), "export const y = 2;");
		writeFileSync(join(tmpDir, "src", "utils", "helper.js"), "export const z = 3;");
		writeFileSync(join(tmpDir, "node_modules", "dep.js"), "module.exports = {};");
		writeFileSync(join(tmpDir, ".git", "config"), "[core]");
		writeFileSync(join(tmpDir, "README.md"), "# Project");
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("finds source files matching include patterns", async () => {
		const files = await scanFiles(tmpDir, ["src/**/*.js", "src/**/*.mjs"], ["node_modules/**", ".git/**"]);
		assert.strictEqual(files.length, 3);
		assert.ok(files.some((f) => f.endsWith("foo.js")));
		assert.ok(files.some((f) => f.endsWith("bar.mjs")));
		assert.ok(files.some((f) => f.endsWith("helper.js")));
	});

	it("excludes node_modules and .git files", async () => {
		const files = await scanFiles(tmpDir, ["**/*.js", "**/*.mjs"], ["node_modules/**", ".git/**"]);
		const hasNodeModules = files.some((f) => f.includes("node_modules"));
		const hasGit = files.some((f) => f.includes(".git"));
		assert.ok(!hasNodeModules, "Should not include node_modules files");
		assert.ok(!hasGit, "Should not include .git files");
	});

	it("returns empty array when no files match", async () => {
		const files = await scanFiles(tmpDir, ["*.xyz"], ["node_modules/**", ".git/**"]);
		assert.strictEqual(files.length, 0);
	});

	it("skips hidden files and directories", async () => {
		mkdirSync(join(tmpDir, ".hidden-dir"), { recursive: true });
		writeFileSync(join(tmpDir, ".hidden-dir", "secret.js"), "hidden");
		writeFileSync(join(tmpDir, ".hidden.js"), "also hidden");
		const files = await scanFiles(tmpDir, ["**/*.js"], ["node_modules/**", ".git/**"]);
		assert.ok(!files.some((f) => f.includes(".hidden")), "Should not include hidden files");
	});

	it("skips binary extensions", async () => {
		writeFileSync(join(tmpDir, "src", "image.png"), "fake-png");
		writeFileSync(join(tmpDir, "src", "archive.zip"), "fake-zip");
		const files = await scanFiles(tmpDir, ["src/**/*"], ["node_modules/**", ".git/**"]);
		assert.ok(!files.some((f) => f.endsWith(".png")), "Should not include .png files");
		assert.ok(!files.some((f) => f.endsWith(".zip")), "Should not include .zip files");
	});
});

describe("reindex", () => {
	/** @type {string} */
	let tmpDir;
	/** @type {string} */
	let dbPath;
	let origFetch;

	before(async () => {
		origFetch = globalThis.fetch;
		tmpDir = mkdtempSync(join(process.cwd(), "tmp", "reindex-test-"));
		dbPath = join(tmpDir, "vector.db");

		mkdirSync(join(tmpDir, "src"), { recursive: true });
		writeFileSync(join(tmpDir, "src", "a.js"), "const a = 1;");
		writeFileSync(join(tmpDir, "src", "b.js"), "const b = 2;");

		// Mock OpenAI for embedder
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
	});

	after(() => {
		globalThis.fetch = origFetch;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("indexes files and stores mtime cache", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const { createEmbedder } = await import("../../../src/vector/embedder.js");
		const { reindex } = await import("../../../src/vector/indexer.js");

		const store = await createVectorStore(dbPath);
		await store.init();
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
		});

		assert.strictEqual(result.indexed, 2);
		assert.strictEqual(result.errors, 0);
		store.close();

		// Verify mtime cache was written
		const mtimePath = dbPath.replace(/\.db$/, "") + "-mtimes.json";
		const mtimeCache = JSON.parse(readFileSync(mtimePath, "utf-8"));
		assert.ok(mtimeCache["src/a.js"] !== undefined);
		assert.ok(mtimeCache["src/b.js"] !== undefined);
	});

	it("skips unchanged files on re-index", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const { createEmbedder } = await import("../../../src/vector/embedder.js");
		const { reindex } = await import("../../../src/vector/indexer.js");

		const store = await createVectorStore(dbPath);
		await store.init();
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
		});

		assert.strictEqual(result.skipped, 2);
		store.close();
	});

	it("force re-indexes all files", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const { createEmbedder } = await import("../../../src/vector/embedder.js");
		const { reindex } = await import("../../../src/vector/indexer.js");

		const store = await createVectorStore(dbPath);
		await store.init();
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
			force: true,
		});

		assert.strictEqual(result.indexed, 2);
		store.close();
	});

	it("skips files exceeding maxFileSize", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const { createEmbedder } = await import("../../../src/vector/embedder.js");
		const { reindex } = await import("../../../src/vector/indexer.js");

		const store = await createVectorStore(dbPath);
		await store.init();
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 0, // No files will fit
		});

		assert.strictEqual(result.indexed, 0);
		store.close();
	});

	it("handles empty directories gracefully", async () => {
		const { createVectorStore } = await import("../../../src/vector/store.js");
		const { createEmbedder } = await import("../../../src/vector/embedder.js");
		const { reindex } = await import("../../../src/vector/indexer.js");

		const emptyDir = mkdtempSync(join(process.cwd(), "tmp", "empty-reindex-"));
		const emptyDb = join(emptyDir, "vector.db");

		const store = await createVectorStore(emptyDb);
		await store.init();
		const embedder = createEmbedder({ model: "openai", openaiApiKey: "sk-test" });

		const result = await reindex(store, embedder, {
			rootDir: emptyDir,
			include: ["src/**/*.js"],
			exclude: [],
		});

		assert.strictEqual(result.indexed, 0);
		assert.strictEqual(result.errors, 0);
		store.close();
		rmSync(emptyDir, { recursive: true, force: true });
	});
});
