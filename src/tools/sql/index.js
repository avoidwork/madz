/**
 * SQL tool.
 * Runs parameterized SQL queries against Postgres, SQLite, and MySQL databases
 * using a registry/plugin architecture for driver extensibility.
 * @module tools/sql
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as postgres from "./drivers/postgres.js";
import * as sqlite from "./drivers/sqlite.js";
import * as mysql from "./drivers/mysql.js";

/** Registry of supported drivers, keyed by driver name. */
export const DRIVERS = {
	postgres,
	sqlite,
	mysql,
};

/** Supported driver names. */
const VALID_DRIVERS = Object.keys(DRIVERS);

/**
 * Core SQL tool logic.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<object>} Result of the operation
 */
export async function sqlImpl(input = {}, options = {}) {
	const { driver, query } = input;

	if (!VALID_DRIVERS.includes(driver)) {
		return {
			ok: false,
			error: `Unknown driver: '${driver}'. Valid drivers: ${VALID_DRIVERS.join(", ")}`,
			kind: "invalid-driver",
		};
	}

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		return {
			ok: false,
			error: "Query is required and must be a non-empty string",
			kind: "invalid-input",
		};
	}

	const driverModule = DRIVERS[driver];
	const allowedPaths = options.allowedPaths || [];
	return driverModule.execute({ ...input, allowedPaths });
}

/**
 * Close all open driver connections.
 * @returns {Promise<void>} Resolves when all connections are closed
 */
export async function closeAll() {
	for (const driverModule of Object.values(DRIVERS)) {
		if (typeof driverModule.close === "function") {
			await driverModule.close();
		}
	}
}

const driverSchema = z.enum(VALID_DRIVERS).describe("Database driver: postgres, sqlite, or mysql");
const connectionSchema = z.object({
	host: z.string().optional().describe("Database host"),
	port: z.number().int().positive().optional().describe("Database port"),
	user: z.string().optional().describe("Database user"),
	password: z.string().optional().describe("Database password"),
	database: z.string().optional().describe("Database name"),
	file: z.string().optional().describe("SQLite file path (or ':memory:')"),
});

/**
 * First-class SQL tool. Runs parameterized SQL queries against Postgres,
 * SQLite, and MySQL databases. Uses a registry/plugin architecture so new
 * drivers can be added without modifying the core dispatch.
 */
export const sql = tool((input, options = {}) => sqlImpl(input, options), {
	name: "sql",
	description:
		"SQL tool. Runs parameterized SQL queries against postgres, sqlite, or mysql databases. " +
		"driver: postgres, sqlite, or mysql. query: the SQL statement. params: bound parameters. " +
		"Uses parameterized queries exclusively (no string concatenation of user input).",
	schema: z.object({
		driver: driverSchema,
		connection: connectionSchema.optional().describe("Connection config"),
		query: z.string().min(1).describe("The SQL query"),
		params: z.array(z.unknown()).optional().describe("Bound parameters for the query"),
	}),
});
