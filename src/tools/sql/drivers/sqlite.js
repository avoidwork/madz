/**
 * SQLite driver for the SQL tool.
 * Uses the `better-sqlite3` synchronous driver.
 * @module tools/sql/drivers/sqlite
 */

import { z } from "zod";
import Database from "better-sqlite3";
import { validatePath } from "../../common.js";

/** Lazily created database connection. */
let db;

/**
 * Get the database connection, creating it lazily on first use.
 * @param {object} connection - Connection config
 * @param {string[]} allowedPaths - Sandbox-allowed paths
 * @returns {import("better-sqlite3").Database} The database connection
 */
function getDb(connection, allowedPaths) {
	if (!db) {
		const file = connection.file || ":memory:";
		if (file !== ":memory:") {
			const check = validatePath(file, allowedPaths);
			if (!check.allowed) {
				throw new Error(`Access denied: ${file} is outside sandbox scope`);
			}
		}
		db = new Database(file);
	}
	return db;
}

/**
 * Execute a parameterized query against SQLite.
 * @param {object} input - Tool input
 * @param {object} input.connection - Connection config
 * @param {string} input.query - The SQL query
 * @param {unknown[]} [input.params] - Query parameters
 * @param {string[]} [input.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<object>} Result of the operation
 */
export async function execute(input) {
	const { connection, query, params = [], allowedPaths = [] } = input;
	try {
		const database = getDb(connection, allowedPaths);
		const stmt = database.prepare(query);
		const isSelect = /^\s*(select|pragma|with)\b/i.test(query);
		if (isSelect) {
			const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
			return { ok: true, rows, rowCount: rows.length };
		}
		const info = params.length > 0 ? stmt.run(...params) : stmt.run();
		return { ok: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
	} catch (err) {
		return { ok: false, error: `SQLite query failed: ${err.message}`, kind: "query-failed" };
	}
}

/**
 * Close the database connection.
 * @returns {void}
 */
export function close() {
	if (db) {
		db.close();
		db = undefined;
	}
}

/** Driver identifier. */
export const name = "sqlite";

/** Connection config schema for SQLite. */
export const connectionSchema = z.object({
	file: z.string().optional().default(""),
});
