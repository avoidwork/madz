import { MemorySaver } from "@langchain/langgraph";

/**
 * Create a LangGraph checkpointer instance based on persistence config.
 * @param {Object} [persistenceConfig] - Persistence configuration from config.yaml
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
	const { SqliteSaver } = require("@langchain/langgraph-checkpoint-sqlite");

	const sqlitePath = persistenceConfig.sqlite_path || "memory/checkpoints.db";

	/* node:coverage ignore next */
	return SqliteSaver.fromConnString(`file:${sqlitePath}?mode=rwc&_journal=WAL`);
}
