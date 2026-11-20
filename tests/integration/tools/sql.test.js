/**
 * Integration tests for the SQL tool.
 * Runs queries against an in-memory SQLite database.
 * @see {@link src/tools/sql/index.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqlImpl, closeAll } from "../../../src/tools/sql/index.js";

const TEST_DIR = join(tmpdir(), `__test_sql_integration__${process.pid}`);
const ALLOWED_PATHS = [TEST_DIR];

function getOptions(policy = {}) {
	return { allowedPaths: ALLOWED_PATHS, policy };
}

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

describe("tools - sql integration", () => {
	before(setupTestFiles);
	after(async () => {
		await closeAll();
		cleanupTestFiles();
	});

	it("rejects a SQLite file path outside the allowlist", async () => {
		const result = await sqlImpl(
			{ driver: "sqlite", query: "SELECT 1" },
			getOptions({ sqlite: { file: "/etc/outside.db" } }),
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "query-failed");
	});

	it("creates a table and inserts a row", async () => {
		const create = await sqlImpl(
			{
				driver: "sqlite",
				query: "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)",
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		assert.strictEqual(create.ok, true);

		const insert = await sqlImpl(
			{
				driver: "sqlite",
				query: "INSERT INTO t (name) VALUES (?)",
				params: ["hello"],
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		assert.strictEqual(insert.ok, true);
		assert.strictEqual(insert.changes, 1);
		assert.strictEqual(insert.lastInsertRowid, 1);
	});

	it("selects rows with parameters", async () => {
		await sqlImpl(
			{
				driver: "sqlite",
				query: "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)",
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		await sqlImpl(
			{
				driver: "sqlite",
				query: "INSERT INTO t (name) VALUES (?)",
				params: ["hello"],
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);

		const select = await sqlImpl(
			{
				driver: "sqlite",
				query: "SELECT * FROM t WHERE id = ?",
				params: [1],
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		assert.strictEqual(select.ok, true);
		assert.strictEqual(select.rowCount, 1);
		assert.strictEqual(select.rows[0].name, "hello");
	});

	it("returns an empty result set for no matches", async () => {
		await sqlImpl(
			{
				driver: "sqlite",
				query: "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)",
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		const select = await sqlImpl(
			{
				driver: "sqlite",
				query: "SELECT * FROM t WHERE id = ?",
				params: [999],
			},
			getOptions({ sqlite: { file: ":memory:" } }),
		);
		assert.strictEqual(select.ok, true);
		assert.strictEqual(select.rowCount, 0);
		assert.deepStrictEqual(select.rows, []);
	});

	it("rejects an unsupported driver", async () => {
		const result = await sqlImpl({ driver: "bogus", query: "SELECT 1" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "invalid-driver");
	});
});
