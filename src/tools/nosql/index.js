/**
 * NoSQL tool.
 * Runs operations against MongoDB (document store) and Redis (key-value store)
 * using a registry/plugin architecture for engine extensibility.
 * @module tools/nosql
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as mongodb from "./engines/mongodb.js";
import * as redis from "./engines/redis.js";

/** Registry of supported engines, keyed by engine name. */
export const ENGINES = {
	mongodb,
	redis,
};

/** Supported engine names. */
const VALID_ENGINES = Object.keys(ENGINES);

/**
 * Core NoSQL tool logic.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<object>} Result of the operation
 */
export async function nosqlImpl(input = {}, options = {}) {
	const { engine } = input;

	if (!VALID_ENGINES.includes(engine)) {
		return {
			ok: false,
			error: `Unknown engine: '${engine}'. Valid engines: ${VALID_ENGINES.join(", ")}`,
			kind: "invalid-engine",
		};
	}

	const engineModule = ENGINES[engine];
	return engineModule.execute(input, options);
}

/**
 * Close all open engine connections.
 * @returns {Promise<void>} Resolves when all connections are closed
 */
export async function closeAll() {
	for (const engineModule of Object.values(ENGINES)) {
		if (typeof engineModule.close === "function") {
			await engineModule.close();
		}
	}
}

const mongodbInputSchema = z.object({
	engine: z.literal("mongodb"),
	connection: mongodb.connectionSchema.optional().describe("MongoDB connection config"),
	operation: mongodb.operationSchema.describe("MongoDB operation"),
});

const redisInputSchema = z.object({
	engine: z.literal("redis"),
	connection: redis.connectionSchema.optional().describe("Redis connection config"),
	operation: redis.operationSchema.describe("Redis operation"),
});

/**
 * First-class NoSQL tool. Runs operations against MongoDB and Redis databases.
 * Uses a registry/plugin architecture so new engines can be added without
 * modifying the core dispatch.
 */
export const nosql = tool((input, options = {}) => nosqlImpl(input, options), {
	name: "nosql",
	description:
		"NoSQL tool. Runs operations against mongodb or redis databases. " +
		"engine: mongodb or redis. connection: connection config. operation: the operation to execute. " +
		"Uses a registry/plugin architecture so new engines can be added without modifying the core dispatch.",
	schema: z.discriminatedUnion("engine", [mongodbInputSchema, redisInputSchema]),
});
