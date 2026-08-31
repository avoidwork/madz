import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import Database from "better-sqlite3";

/**
 * Create a LangGraph checkpointer instance based on persistence config.
 * @param {Object} fullConfig - Full application config containing both persistence and memory sections
 * @param {Object} fullConfig.persistence - Persistence configuration
 * @param {"memory"|"sqlite"} fullConfig.persistence.mode - Persistence mode
 * @param {string} [fullConfig.persistence.sqlite_path] - Optional explicit SQLite DB path
 * @param {Object} fullConfig.memory - Memory configuration
 * @param {string} fullConfig.memory.checkpointsDir - Directory for checkpoint files
 * @returns {import("@langchain/langgraph").BaseCheckpointSaver | null} A checkpointer instance, or null if mode is not supported
 */
export async function createCheckpointer(persistenceConfig) {
	if (!persistenceConfig) {
		return null;
	}

	const mode = fullConfig.persistence.mode || "sqlite";

	switch (mode) {
		case "memory": {
			return new MemorySaver();
		}
		case "sqlite": {
			/* node:coverage ignore next */
			return createSqliteCheckpointer(fullConfig);
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
