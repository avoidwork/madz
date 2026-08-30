import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createCheckpointer } from "../../src/session/checkpointer.js";
import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("createCheckpointer", () => {
	it("returns MemorySaver for memory mode", async () => {
		const cp = await createCheckpointer({ mode: "memory" });
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns MemorySaver when config is empty", async () => {
		const cp = await createCheckpointer({});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null when config is undefined", async () => {
		const cp = await createCheckpointer(undefined);
		assert.strictEqual(cp, null);
	});

	it("returns MemorySaver for unknown mode (fallback)", async () => {
		const cp = await createCheckpointer({ mode: "redis" });
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null for null config", async () => {
		const cp = await createCheckpointer(null);
		assert.strictEqual(cp, null);
	});

	it("falls back to MemorySaver for unrecognized mode string", async () => {
		const cp = await createCheckpointer({ mode: "postgres" });
		assert.ok(cp instanceof MemorySaver);
	});

	describe("sqlite mode", () => {
		const testDir = join(tmpdir(), "checkpointer-test-" + Date.now());
		const dbPath = join(testDir, "subdir", "checkpoints.db");

		before(() => {
			// Remove any leftover state
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		after(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		it("creates SqliteSaver and initializes the DB file", async () => {
			const cp = await createCheckpointer({ mode: "sqlite", sqlite_path: dbPath });
			assert.ok(cp instanceof SqliteSaver);
			assert.ok(existsSync(dbPath), "DB file should be created");
		});

		it("creates parent directories when they don't exist", async () => {
			const nestedPath = join(testDir, "deep", "nested", "path", "test.db");
			const cp = await createCheckpointer({ mode: "sqlite", sqlite_path: nestedPath });
			assert.ok(cp instanceof SqliteSaver);
			assert.ok(existsSync(nestedPath), "Nested DB file should be created");
		});

		it("uses default path when sqlite_path is not provided", async () => {
			const cp = await createCheckpointer({ mode: "sqlite" });
			assert.ok(cp instanceof SqliteSaver);
		});
	});
});
