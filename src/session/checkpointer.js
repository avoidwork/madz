import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join } from "node:path";

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
export function createCheckpointer(fullConfig) {
	if (!fullConfig?.persistence) {
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
 * @param {Object} fullConfig - Full application config containing persistence and memory sections
 * @param {Object} fullConfig.persistence - Persistence configuration
 * @param {string} [fullConfig.persistence.sqlite_path] - Optional explicit SQLite DB path
 * @param {Object} fullConfig.memory - Memory configuration
 * @param {string} fullConfig.memory.checkpointsDir - Directory for checkpoint files
 * @returns {import("@langchain/langgraph-checkpoint-sqlite").SqliteSaver}
 */
/* node:coverage ignore next */
function createSqliteCheckpointer(fullConfig) {
	const explicitPath = fullConfig.persistence?.sqlite_path;
	const checkpointsDir = fullConfig.memory?.checkpointsDir || "memory/checkpoints/";
	const sqlitePath = explicitPath || join(checkpointsDir, "checkpoints.db");

	/* node:coverage ignore next */
	const saver = SqliteSaver.fromConnString(sqlitePath);

	/* node:coverage ignore next */
	saver.setup();

	/* node:coverage ignore next */
	saver.db.pragma("synchronous = NORMAL");

	/* node:coverage ignore next */
	return saver;
}
