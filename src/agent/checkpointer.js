import { createRequire } from "node:module";

// oxlint-disable no-console

const DB_PATH = "memory/checkpoints/langgraph.db";

/**
 * Create a SQLite checkpointer for LangGraph ReAct agent.
 * Uses @langchain/langgraph-checkpoint-sqlite (SQLiteSaver) for persistent session state.
 * Falls back to no checkpointer if `agent.checkpoints.enabled` is false or native binding fails.
 * @param {object} config - Application config object (from loadConfig)
 * @returns {{ saver: import("@langchain/langgraph-checkpoint-sqlite").SQLiteSaver | null, threadConfig: null }} Saver instance and thread config or nulls if disabled
 */
export function createCheckpointer(config) {
	const checkpointsConfig = config.agent?.checkpoints || { enabled: true };

	if (!checkpointsConfig.enabled) {
		return { saver: null, threadConfig: null };
	}

	const sqliteSaverOrError = _initSaver();
	if (!sqliteSaverOrError.saver) {
		// node:coverage ignore next
		return sqliteSaverOrError;
	}
	// node:coverage ignore next
	return { saver: sqliteSaverOrError.saver, threadConfig: {} };
}

// node:coverage ignore next
function _initSaver() {
	try {
		const require = createRequire(import.meta.url);
		const SQLiteSaver = require("@langchain/langgraph-checkpoint-sqlite").SQLiteSaver;

		const saver = new SQLiteSaver({ dbUrl: DB_PATH });
		return { saver, threadConfig: {} };
	} catch (err) {
		console.warn(
			"[SQLiteSaver] Failed to initialize checkpointer, continuing without persistence:",
			err.message,
		);
		return { saver: null, threadConfig: null };
	}
}
