import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig } from "../config/loader.js";

const cwd = loadConfig().cwd;

/**
 * Ensure the checkpoints directory exists by creating it if necessary.
 * @param {string} checkpointsDir - Path to checkpoints directory
 * @param {string} [cwdParam] - Base directory (defaults to project cwd)
 * @returns {Promise<void>}
 */
export async function ensureCheckpointsDir(checkpointsDir, cwdParam = cwd) {
	const dir = join(cwdParam, checkpointsDir);
	await mkdir(dir, { recursive: true });
}

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
	const checkpointsDir = fullConfig.memory?.checkpointsDir || "memory/checkpoints/";
	const sqlitePath = resolve(checkpointsDir, "checkpoints.db");

	/* node:coverage ignore next */
	const saver = SqliteSaver.fromConnString(sqlitePath);

	/* node:coverage ignore next */
	saver.setup();

	/* node:coverage ignore next */
	saver.db.pragma("synchronous = NORMAL");

	/* node:coverage ignore next */
	return saver;
}
