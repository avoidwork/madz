import { describe, it } from "node:test";
import assert from "node:assert";
import { createCheckpointer, ensureCheckpointsDir } from "../../src/session/checkpointer.js";
import { MemorySaver } from "@langchain/langgraph";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("createCheckpointer", () => {
	it("returns MemorySaver for memory mode", () => {
		const cp = createCheckpointer({
			persistence: { mode: "memory" },
			memory: { checkpointsDir: "memory/checkpoints/" },
		});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null when config is undefined", () => {
		const cp = createCheckpointer(undefined);
		assert.strictEqual(cp, null);
	});

	it("returns MemorySaver for unknown mode (fallback)", () => {
		const cp = createCheckpointer({
			persistence: { mode: "redis" },
			memory: { checkpointsDir: "memory/checkpoints/" },
		});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null for null config", () => {
		const cp = createCheckpointer(null);
		assert.strictEqual(cp, null);
	});

	it("falls back to MemorySaver for unrecognized mode string", () => {
		const cp = createCheckpointer({
			persistence: { mode: "postgres" },
			memory: { checkpointsDir: "memory/checkpoints/" },
		});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null when config has no persistence section", () => {
		const cp = createCheckpointer({ memory: { checkpointsDir: "memory/checkpoints/" } });
		assert.strictEqual(cp, null);
	});

	it("returns MemorySaver when persistence mode is memory with explicit config", () => {
		const cp = createCheckpointer({
			persistence: { mode: "memory" },
			memory: { checkpointsDir: "custom/checkpoints/" },
		});
		assert.ok(cp instanceof MemorySaver);
	});

	it("returns null when config is empty object", () => {
		const cp = createCheckpointer({});
		assert.strictEqual(cp, null);
	});

	it("returns null when persistence is null", () => {
		const cp = createCheckpointer({ persistence: null, memory: { checkpointsDir: "memory/checkpoints/" } });
		assert.strictEqual(cp, null);
	});
});

describe("ensureCheckpointsDir", () => {
	it("should create the checkpoints directory", async () => {
		const testDir = "/tmp/test-checkpoints-" + Date.now();
		await ensureCheckpointsDir("checkpoints/", testDir);
		const fs = await import("node:fs");
		assert.ok(fs.existsSync(join(testDir, "checkpoints")));
		await rm(testDir, { recursive: true, force: true });
	});

	it("should create nested checkpoints directories", async () => {
		const testDir = "/tmp/test-checkpoints-nested-" + Date.now();
		await ensureCheckpointsDir("a/b/checkpoints/", testDir);
		const fs = await import("node:fs");
		assert.ok(fs.existsSync(join(testDir, "a", "b", "checkpoints")));
		await rm(testDir, { recursive: true, force: true });
	});
});
