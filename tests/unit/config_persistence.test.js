import { describe, it } from "node:test";
import assert from "node:assert";
import { PersistenceSchema, DEFAULT_CONFIG } from "../../src/config/schemas.js";

describe("PersistenceSchema", () => {
	it("validates memory mode", () => {
		const result = PersistenceSchema.safeParse({
			mode: "memory",
			sqlite_path: "memory/checkpoints.db",
		});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "memory");
	});

	it("validates sqlite mode", () => {
		const result = PersistenceSchema.safeParse({
			mode: "sqlite",
			sqlite_path: "data/checkpoints.db",
		});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "sqlite");
		assert.strictEqual(result.data.sqlite_path, "data/checkpoints.db");
	});

	it("defaults to memory mode when omitted", () => {
		const result = PersistenceSchema.safeParse({});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "memory");
		assert.strictEqual(result.data.sqlite_path, "memory/checkpoints.db");
	});

	it("rejects invalid mode", () => {
		const result = PersistenceSchema.safeParse({ mode: "redis" });
		assert.strictEqual(result.success, false);
	});

	it("uses default sqlite_path when omitted", () => {
		const result = PersistenceSchema.safeParse({ mode: "memory" });
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.sqlite_path, "memory/checkpoints.db");
	});

	it("accepts custom sqlite_path for sqlite mode", () => {
		const result = PersistenceSchema.safeParse({ mode: "sqlite", sqlite_path: "/tmp/my.db" });
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.sqlite_path, "/tmp/my.db");
	});
});

describe("DEFAULT_CONFIG.persistence", () => {
	it("has memory mode in defaults", () => {
		assert.strictEqual(DEFAULT_CONFIG.persistence.mode, "memory");
	});

	it("has default sqlite_path", () => {
		assert.strictEqual(DEFAULT_CONFIG.persistence.sqlite_path, "memory/checkpoints.db");
	});
});
