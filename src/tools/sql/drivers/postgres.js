/**
 * Postgres driver for the SQL tool.
 * Uses the `pg` (node-postgres) driver with connection pooling.
 * @module tools/sql/drivers/postgres
 */

import { z } from "zod";
import pg from "pg";

/** Lazily created connection pool. */
let pool;

/**
 * Get the connection pool, creating it lazily on first use.
 * @param {object} connection - Connection config
 * @returns {import("pg").Pool} The connection pool
 */
function getPool(connection) {
	if (!pool) {
		pool = new pg.Pool({
			host: connection.host || undefined,
			port: connection.port || undefined,
			user: connection.user || undefined,
			password: connection.password || undefined,
			database: connection.database || undefined,
		});
	}
	return pool;
}

/**
 * Execute a parameterized query against Postgres.
 * @param {object} input - Tool input
 * @param {object} input.connection - Connection config
 * @param {string} input.query - The SQL query
 * @param {unknown[]} [input.params] - Query parameters
 * @returns {Promise<object>} Result of the operation
 */
export async function execute(input) {
	const { connection, query, params = [] } = input;
	const pool = getPool(connection);
	try {
		const result = await pool.query(query, params);
		return { ok: true, rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
	} catch (err) {
		return { ok: false, error: `Postgres query failed: ${err.message}`, kind: "query-failed" };
	}
}

/**
 * Close the connection pool.
 * @returns {Promise<void>} Resolves when the pool is closed
 */
export async function close() {
	if (pool) {
		await pool.end();
		pool = undefined;
	}
}

/** Driver identifier. */
export const name = "postgres";

/** Connection config schema for Postgres. */
export const connectionSchema = z.object({
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(5432),
	user: z.string().optional().default(""),
	password: z.string().optional().default(""),
	database: z.string().optional().default(""),
});
