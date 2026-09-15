import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("indexCode worker", () => {
	let origFetch;
	let tmpDir;

	before(() => {
		origFetch = globalThis.fetch;
		tmpDir = mkdtempSync(join(process.cwd(), "tmp", "codeindex-worker-"));
		mkdirSync(join(tmpDir, "src"), { recursive: true });
		writeFileSync(join(tmpDir, "src", "a.js"), "const a = 1;");

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

	it("creates store and embedder internally and runs reindex", async () => {
		const { default: indexWorker } = await import("../../../src/vector/indexerWorker.js");
		const result = await indexWorker({
			dbPath: join(tmpDir, "vector.db"),
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			chunkSize: 96,
			chunkOverlap: 16,
			maxFileSize: 524288,
			force: false,
			model: "openai",
			openaiApiKey: "sk-test",
			fulltext: false,
		});

		assert.strictEqual(result.indexed, 1);
		assert.strictEqual(result.errors, 0);
	});

	it("applies defaults when config fields are omitted", async () => {
		const { default: indexWorker } = await import("../../../src/vector/indexerWorker.js");
		const result = await indexWorker({
			dbPath: join(tmpDir, "defaults.db"),
			rootDir: tmpDir,
			include: ["src/**/*.js"],
			exclude: [],
			model: "openai",
			openaiApiKey: "sk-test",
		});

		assert.strictEqual(result.indexed, 1);
		assert.strictEqual(result.errors, 0);
	});
});

describe("indexCode tool", () => {
	let pool;

	before(async () => {
		const mod = await import("../../../src/tools/code/indexCode.js");
		pool = mod.pool;
	});

	after(async () => {
		mock.restoreAll();
		await pool.destroy();
	});

	it("returns message when no projects configured", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		const result = await indexCodeImpl({}, { vector: { projects: {} } });
		assert.ok(result.includes("No vector projects configured"), `Got: ${result}`);
	});

	it("returns unknown project message when project not found", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		const result = await indexCodeImpl(
			{ project: "nonexistent" },
			{ vector: { projects: { madz: { dbPath: "/tmp/test.db" } } } },
		);
		assert.ok(result.includes('Project "nonexistent" not found'), `Got: ${result}`);
	});

	it("dispatches project config to the pool and formats results", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		let dispatched;
		mock.method(pool, "run", async (task) => {
			dispatched = task;
			return { indexed: 2, skipped: 1, errors: 0 };
		});

		const result = await indexCodeImpl(
			{ project: "madz" },
			{ vector: { projects: { madz: { dbPath: "/tmp/test.db", rootDir: "/tmp" } } } },
		);

		assert.strictEqual(result, "madz: 2 indexed, 1 skipped, 0 errors");
		assert.ok(dispatched, "pool.run should have been called");
		assert.strictEqual(dispatched.dbPath, "/tmp/test.db");
		assert.strictEqual(dispatched.rootDir, "/tmp");
		assert.strictEqual(dispatched.force, false);
	});

	it("passes force flag through to the pool", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		let dispatched;
		mock.method(pool, "run", async (task) => {
			dispatched = task;
			return { indexed: 0, skipped: 0, errors: 0 };
		});

		await indexCodeImpl(
			{ project: "madz", force: true },
			{ vector: { projects: { madz: { dbPath: "/tmp/test.db" } } } },
		);

		assert.strictEqual(dispatched.force, true);
	});

	it("handles pool errors gracefully", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		mock.method(pool, "run", async () => {
			throw new Error("worker crashed");
		});

		const result = await indexCodeImpl(
			{ project: "madz" },
			{ vector: { projects: { madz: { dbPath: "/tmp/test.db" } } } },
		);

		assert.strictEqual(result, "madz: error — worker crashed");
	});

	it("indexes all projects when no project specified", async () => {
		const { indexCodeImpl } = await import("../../../src/tools/code/indexCode.js");
		const calls = [];
		mock.method(pool, "run", async (task) => {
			calls.push(task);
			return { indexed: 1, skipped: 0, errors: 0 };
		});

		const result = await indexCodeImpl(
			{},
			{
				vector: {
					projects: {
						madz: { dbPath: "/tmp/madz.db" },
						other: { dbPath: "/tmp/other.db" },
					},
				},
			},
		);

		assert.strictEqual(calls.length, 2);
		assert.ok(result.includes("madz: 1 indexed, 0 skipped, 0 errors"));
		assert.ok(result.includes("other: 1 indexed, 0 skipped, 0 errors"));
	});
});
