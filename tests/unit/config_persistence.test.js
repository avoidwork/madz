import { describe, it } from "node:test";
import assert from "node:assert";
import { PersistenceSchema } from "../../src/config/config.js";

describe("PersistenceSchema", () => {
	it("validates memory mode", () => {
		const result = PersistenceSchema.safeParse({
			mode: "memory",
		});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "memory");
	});

	it("validates sqlite mode", () => {
		const result = PersistenceSchema.safeParse({
			mode: "sqlite",
		});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "sqlite");
	});

	it("defaults to sqlite mode when omitted", () => {
		const result = PersistenceSchema.safeParse({});
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.data.mode, "sqlite");
	});

	it("rejects invalid mode", () => {
		const result = PersistenceSchema.safeParse({ mode: "redis" });
		assert.strictEqual(result.success, false);
	});
});

describe("PersistenceSchema defaults", () => {
	const defaults = PersistenceSchema.parse({});

	it("has sqlite mode in defaults", () => {
		assert.strictEqual(defaults.mode, "sqlite");
	});
});
