import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { resolve, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import Database from "better-sqlite3";

/**
 * Create a LangGraph checkpointer instance based on persistence config.
 * @param {Object} [persistenceConfig] - Persistence configuration from config
 * @param {"memory"|"sqlite"|"null"} [persistenceConfig.mode="memory"] - Persistence mode
 * @param {string} [persistenceConfig.sqlite_path="memory/checkpoints.db"] - SQLite DB file path
 * @returns {import("@langchain/langgraph").BaseCheckpointSaver | null} A checkpointer instance, or null if mode is not supported
 */
export function createCheckpointer(persistenceConfig) {
	if (!persistenceConfig) {
		return null;
	}

	const mode = persistenceConfig.mode || "memory";

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
 * @returns {import("@langchain/langgraph-checkpoint-sqlite").SqliteSaver}
 */
/* node:coverage ignore next */
function createSqliteCheckpointer(persistenceConfig) {
	const sqlitePath = resolve(persistenceConfig.sqlite_path || "memory/checkpoints.db");

	// Ensure parent directory exists — better-sqlite3 won't create it
	const dir = dirname(sqlitePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	// Create Database directly with absolute path (not file: URI)
	// better-sqlite3 doesn't parse file: URIs reliably
	const db = new Database(sqlitePath);
	db.pragma("journal_mode=WAL");

	return new SqliteSaver(db);
}
