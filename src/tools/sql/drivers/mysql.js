/**
 * MySQL driver for the SQL tool.
 * Uses the `mysql2` promise API.
 * @module tools/sql/drivers/mysql
 */

import { z } from "zod";
import mysql from "mysql2/promise";

/** Lazily created connection. */
let connection;

/**
 * Get the connection, creating it lazily on first use.
 * @param {object} connectionConfig - Connection config
 * @returns {Promise<import("mysql2/promise").Connection>} The connection
 */
async function getConnection(connectionConfig) {
	if (!connection) {
		connection = await mysql.createConnection({
			host: connectionConfig.host || undefined,
			port: connectionConfig.port || undefined,
			user: connectionConfig.user || undefined,
			password: connectionConfig.password || undefined,
			database: connectionConfig.database || undefined,
		});
	}
	return connection;
}

/**
 * Execute a parameterized query against MySQL.
 * @param {object} input - Tool input
 * @param {object} input.connection - Connection config
 * @param {string} input.query - The SQL query
 * @param {unknown[]} [input.params] - Query parameters
 * @returns {Promise<object>} Result of the operation
 */
export async function execute(input) {
	const { connection: connectionConfig, query, params = [] } = input;
	try {
		const conn = await getConnection(connectionConfig);
		const [rows, fields] = await conn.execute(query, params);
		if (Array.isArray(rows)) {
			return { ok: true, rows, rowCount: rows.length, fields };
		}
		return { ok: true, affectedRows: rows.affectedRows, insertId: rows.insertId };
	} catch (err) {
		return { ok: false, error: `MySQL query failed: ${err.message}`, kind: "query-failed" };
	}
}

/**
 * Close the connection.
 * @returns {Promise<void>} Resolves when the connection is closed
 */
export async function close() {
	if (connection) {
		await connection.end();
		connection = undefined;
	}
}

/** Driver identifier. */
export const name = "mysql";

/** Connection config schema for MySQL. */
export const connectionSchema = z.object({
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(3306),
	user: z.string().optional().default(""),
	password: z.string().optional().default(""),
	database: z.string().optional().default(""),
});
