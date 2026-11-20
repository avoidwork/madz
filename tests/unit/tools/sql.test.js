/**
 * Tests for the SQL tool.
 * @see {@link src/tools/sql/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { sql, sqlImpl, DRIVERS } from "../../../src/tools/sql/index.js";

describe("tools - sql", () => {
	describe("Zod schema validation", () => {
		it("validates all drivers", () => {
			for (const driver of ["postgres", "sqlite", "mysql"]) {
				const result = sql.schema.safeParse({
					driver,
					query: "SELECT 1",
				});
				assert.ok(result.success, `driver '${driver}' should be valid`);
			}
		});

		it("rejects invalid driver", () => {
			const result = sql.schema.safeParse({ driver: "bogus", query: "SELECT 1" });
			assert.strictEqual(result.success, false);
		});

		it("rejects missing query", () => {
			const result = sql.schema.safeParse({ driver: "sqlite" });
			assert.strictEqual(result.success, false);
		});

		it("accepts params array", () => {
			const result = sql.schema.safeParse({
				driver: "sqlite",
				query: "SELECT * FROM t WHERE id = ?",
				params: [1],
			});
			assert.ok(result.success);
		});

		it("does not accept connection config from the model", () => {
			// Connection is sourced server-side from config; the schema strips
			// any connection the model supplies.
			const result = sql.schema.safeParse({
				driver: "postgres",
				connection: { host: "localhost", port: 5432 },
				query: "SELECT 1",
			});
			assert.ok(result.success);
			assert.strictEqual(result.data.connection, undefined);
		});
	});

	describe("sqlImpl validation", () => {
		it("rejects unknown driver", async () => {
			const result = await sqlImpl(
				{ driver: "bogus", query: "SELECT 1" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-driver");
		});

		it("rejects missing query", async () => {
			const result = await sqlImpl({ driver: "sqlite" }, { allowedPaths: ["/tmp"] });
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-input");
		});

		it("rejects empty query", async () => {
			const result = await sqlImpl({ driver: "sqlite", query: "   " }, { allowedPaths: ["/tmp"] });
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-input");
		});

		it("sources connection from server-side config policy", async () => {
			// The driver's execute receives the connection resolved from the
			// policy (config.sql[driver]), not from model input.
			const policy = { sqlite: { file: ":memory:" } };
			const result = await sqlImpl(
				{ driver: "sqlite", query: "SELECT 1" },
				{ allowedPaths: ["/tmp"], policy },
			);
			assert.strictEqual(result.ok, true);
		});
	});

	describe("DRIVERS registry", () => {
		it("registers postgres, sqlite, and mysql", () => {
			assert.ok(DRIVERS.postgres, "postgres driver should be registered");
			assert.ok(DRIVERS.sqlite, "sqlite driver should be registered");
			assert.ok(DRIVERS.mysql, "mysql driver should be registered");
		});

		it("each driver exports name, connectionSchema, and execute", () => {
			for (const driver of Object.values(DRIVERS)) {
				assert.strictEqual(typeof driver.name, "string", "driver should export a name");
				assert.ok(driver.connectionSchema, "driver should export a connectionSchema");
				assert.strictEqual(
					typeof driver.execute,
					"function",
					"driver should export an execute function",
				);
			}
		});
	});
});
