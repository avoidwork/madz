import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import Database from "better-sqlite3";

/**
 * Create a LangGraph checkpointer instance based on persistence config.
 * @param {Object} persistenceConfig - Persistence configuration
 * @param {"memory"|"sqlite"} [persistenceConfig.mode] - Persistence mode (defaults to "sqlite")
 * @param {string} [persistenceConfig.sqlite_path] - Optional explicit SQLite DB path
 * @returns {import("@langchain/langgraph").BaseCheckpointSaver | null} A checkpointer instance, or null if config is falsy
 */
export async function createCheckpointer(persistenceConfig) {
	if (!persistenceConfig) {
		return null;
	}

	const mode = persistenceConfig.mode || "sqlite";

	switch (mode) {
		case "memory": {
			return new MemorySaver();
		}
		case "sqlite": {
			/* node:coverage ignore next */
			return createSqliteCheckpointer(persistenceConfig);
		}
		default: {
			return new MemorySaver();
		}
	}
}

/**
 * Create an SQLite-backed checkpointer.
 * @param {Object} persistenceConfig - Persistence configuration with sqlite_path
 * @param {string} persistenceConfig.sqlite_path - Path to the SQLite database file
 * @returns {Promise<import("@langchain/langgraph-checkpoint-sqlite").SqliteSaver>}
 */
/* node:coverage ignore next */
async function createSqliteCheckpointer(persistenceConfig) {
	const sqlitePath = resolve(persistenceConfig.sqlite_path || "memory/checkpoints.db");

	// Ensure parent directory exists — better-sqlite3 won't create it
	// mkdir with recursive: true is idempotent — no need to check first
	const dir = dirname(sqlitePath);
	await mkdir(dir, { recursive: true });

	// Create Database directly with absolute path (not file: URI)
	// better-sqlite3 doesn't parse file: URIs reliably
	const db = new Database(sqlitePath);
	db.pragma("journal_mode=WAL");

	return new SqliteSaver(db);
}
