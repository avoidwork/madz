import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { createVectorStore } from "../../../src/vector/store.js";
import { createEmbedder } from "../../../src/vector/embedder.js";
import { compileGlob, scanFiles, reindex } from "../../../src/vector/indexer.js";

const vec = (v) => new Float32Array(384).fill(v);

describe("store audit fixes", () => {
	it("rejects malicious ftsTokenize", async () => {
		await assert.rejects(
			createVectorStore(":memory:", {
				fulltext: true,
				ftsTokenize: "unicode61'); DROP TABLE x;--",
			}),
		);
	});

	it("rejects wrong embedding length", async () => {
		const s = await createVectorStore(":memory:");
		s.init();
		assert.throws(() =>
			s.insertChunks([
				{ filePath: "a", lineStart: 1, lineEnd: 1, content: "x", embedding: new Float32Array(3) },
			]),
		);
		s.close();
	});

	it("replaceFile is atomic and hybridSearch validates topK / survives bad FTS", async () => {
		const s = await createVectorStore(":memory:", { fulltext: true });
		s.init();
		const c = (content, v) => ({
			filePath: "a.js",
			lineStart: 1,
			lineEnd: 1,
			content,
			embedding: vec(v),
		});
		s.insertChunks([c("old stuff", 0.1)]);
		s.replaceFile("a.js", [c("new stuff", 0.1)]);
		assert.strictEqual(s.search(vec(0.1), 10).length, 1);
		assert.strictEqual(s.searchFts("new", 5).length, 1);
		assert.strictEqual(s.searchFts("old", 5).length, 0);
		assert.throws(() => s.hybridSearch(vec(0.1), "x", 0));
		assert.throws(() => s.hybridSearch(vec(0.1), "x", 5000));
		assert.ok(s.hybridSearch(vec(0.1), 'AND OR "unbalanced (', 5).length >= 1);
		s.close();
	});
});

describe("glob", () => {
	it("escapes specials and handles **", () => {
		assert.ok(compileGlob("src/**").test("src/a/b.js"));
		assert.ok(compileGlob("src/**/*.js").test("src/x.js"));
		assert.ok(!compileGlob("a+b.js").test("aab.js"));
		assert.ok(compileGlob("a+b.js").test("a+b.js"));
		assert.ok(!compileGlob("*.js").test("a/b.js"));
	});
});

describe("embedder audit fixes", () => {
	it("rejects non-https baseURL", () => {
		assert.throws(() =>
			createEmbedder({ model: "openai", openaiApiKey: "k", baseURL: "http://x.test" }),
		);
	});

	it("validates response shape and retries on 429", async () => {
		const orig = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = async (_u, opts) => {
			calls++;
			if (calls === 1) return { ok: false, status: 429, text: async () => "slow down" };
			const body = JSON.parse(opts.body);
			return {
				ok: true,
				json: async () => ({
					data: body.input.map((_, i) => ({ index: i, embedding: new Array(384).fill(0.1) })),
				}),
			};
		};
		try {
			const e = createEmbedder({ model: "openai", openaiApiKey: "k" });
			const out = await e.embed(["a", "b"]);
			assert.strictEqual(out.length, 2);
			assert.strictEqual(calls, 2);
			globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
			await assert.rejects(e.embed(["a"]));
		} finally {
			globalThis.fetch = orig;
		}
	});
});

describe("indexer audit fixes", () => {
	it("skips secrets and symlink escapes, removes deleted files, reports errorDetails", async () => {
		const tmp = mkdtempSync(join(process.cwd(), "tmp", "audit-"));
		const outside = mkdtempSync(join(process.cwd(), "tmp", "audit-out-"));
		try {
			mkdirSync(join(tmp, "src"), { recursive: true });
			writeFileSync(join(tmp, "src", "a.js"), "const a = 1;");
			writeFileSync(join(tmp, "src", "b.js"), "const b = 1;");
			writeFileSync(join(tmp, "src", "x.pem"), "secret");
			writeFileSync(join(outside, "evil.js"), "evil");
			symlinkSync(join(outside, "evil.js"), join(tmp, "src", "link.js"));
			const files = await scanFiles(tmp, ["src/**"], []);
			assert.ok(!files.includes("src/x.pem"));

			const store = await createVectorStore(join(tmp, "v.db"));
			store.init();
			const embedder = { embed: async (t) => t.map(() => vec(0.1)) };
			const opts = { rootDir: tmp, include: ["src/**/*.js"], exclude: [], maxFileSize: 1e6 };
			const r1 = await reindex(store, embedder, opts);
			assert.strictEqual(r1.indexed, 2);
			rmSync(join(tmp, "src", "b.js"));
			const r2 = await reindex(store, embedder, opts);
			assert.strictEqual(r2.removed, 1);
			assert.deepStrictEqual(store.listFiles(), ["src/a.js"]);

			const bad = {
				embed: async () => {
					throw new Error("boom");
				},
			};
			const r3 = await reindex(store, bad, { ...opts, force: true });
			assert.strictEqual(r3.errorDetails[0].message, "boom");
			store.close();
		} finally {
			rmSync(tmp, { recursive: true, force: true });
			rmSync(outside, { recursive: true, force: true });
		}
	});
});
