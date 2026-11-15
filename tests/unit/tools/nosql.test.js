/**
 * Tests for the NoSQL tool.
 * @see {@link src/tools/nosql/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { nosql, nosqlImpl, ENGINES } from "../../../src/tools/nosql/index.js";

describe("tools - nosql", () => {
	describe("Zod schema validation", () => {
		it("validates all engines", () => {
			const mongodb = nosql.schema.safeParse({
				engine: "mongodb",
				operation: { op: "find", collection: "users" },
			});
			assert.ok(mongodb.success, "mongodb engine should be valid");

			const redis = nosql.schema.safeParse({
				engine: "redis",
				operation: { op: "get", key: "foo" },
			});
			assert.ok(redis.success, "redis engine should be valid");
		});

		it("rejects invalid engine", () => {
			const result = nosql.schema.safeParse({
				engine: "bogus",
				operation: { op: "get", key: "foo" },
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects missing operation", () => {
			const result = nosql.schema.safeParse({ engine: "mongodb" });
			assert.strictEqual(result.success, false);
		});

		it("rejects invalid operation for engine", () => {
			const result = nosql.schema.safeParse({
				engine: "mongodb",
				operation: { op: "get", key: "foo" },
			});
			assert.strictEqual(result.success, false);
		});

		it("accepts connection config", () => {
			const result = nosql.schema.safeParse({
				engine: "mongodb",
				connection: { host: "localhost", port: 27017 },
				operation: { op: "find", collection: "users" },
			});
			assert.ok(result.success);
		});
	});

	describe("nosqlImpl validation", () => {
		it("rejects unknown engine", async () => {
			const result = await nosqlImpl({ engine: "bogus" });
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-engine");
		});
	});

	describe("ENGINES registry", () => {
		it("registers mongodb and redis", () => {
			assert.ok(ENGINES.mongodb, "mongodb engine should be registered");
			assert.ok(ENGINES.redis, "redis engine should be registered");
		});

		it("each engine exports name, connectionSchema, operationSchema, and execute", () => {
			for (const engine of Object.values(ENGINES)) {
				assert.strictEqual(typeof engine.name, "string", "engine should export a name");
				assert.ok(engine.connectionSchema, "engine should export a connectionSchema");
				assert.ok(engine.operationSchema, "engine should export an operationSchema");
				assert.strictEqual(
					typeof engine.execute,
					"function",
					"engine should export an execute function",
				);
			}
		});
	});
});
