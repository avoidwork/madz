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

/**
 * Flat connection schema merging the MongoDB and Redis connection configs so
 * the serialized tool schema is a plain object (no top-level `oneOf`). Fields
 * are optional; each engine's `execute` applies its own defaults.
 */
const connectionSchema = z.object({
	connectionString: z.string().optional().describe("MongoDB connection string"),
	host: z.string().optional().describe("Database host"),
	port: z.number().int().positive().optional().describe("Database port"),
	credentials: z
		.object({
			username: z.string().optional().describe("Username"),
			password: z.string().optional().describe("Password"),
			database: z.string().optional().describe("Database name"),
		})
		.optional()
		.describe("Connection credentials"),
	db: z.number().int().nonnegative().optional().describe("Redis database index"),
});

/**
 * Flat operation schema merging the MongoDB and Redis operation fields so the
 * serialized tool schema is a plain object (no top-level `oneOf`). Per-engine
 * validity is enforced in `superRefine` below.
 */
const operationSchema = z.object({
	op: z
		.enum([
			"find",
			"findOne",
			"insertOne",
			"insertMany",
			"updateOne",
			"updateMany",
			"deleteOne",
			"deleteMany",
			"aggregate",
			"countDocuments",
			"get",
			"set",
			"hget",
			"hset",
			"hgetall",
			"lpush",
			"lrange",
			"del",
			"expire",
			"exists",
			"keys",
		])
		.describe("The operation to execute"),
	collection: z.string().min(1).optional().describe("MongoDB collection name"),
	filter: z.record(z.unknown()).optional().describe("MongoDB filter document"),
	update: z.record(z.unknown()).optional().describe("MongoDB update document"),
	document: z.record(z.unknown()).optional().describe("MongoDB document to insert"),
	documents: z.array(z.record(z.unknown())).optional().describe("MongoDB documents to insert"),
	pipeline: z.array(z.record(z.unknown())).optional().describe("MongoDB aggregation pipeline"),
	options: z.record(z.unknown()).optional().describe("MongoDB operation options"),
	key: z.string().optional().describe("Redis key"),
	field: z.string().optional().describe("Redis hash field"),
	value: z.union([z.string(), z.number()]).optional().describe("Redis value"),
	values: z
		.array(z.union([z.string(), z.number()]))
		.optional()
		.describe("Redis values"),
	start: z.number().int().optional().describe("Redis range start"),
	stop: z.number().int().optional().describe("Redis range stop"),
	seconds: z.number().int().optional().describe("Redis expiry seconds"),
	pattern: z.string().optional().describe("Redis key pattern"),
	keys: z.array(z.string()).optional().describe("Redis keys"),
});

/**
 * Zod schema for the `nosql` tool input.
 *
 * A single flat object with an `engine` enum so the serialized JSON schema is
 * a plain object rather than a top-level `oneOf`. Per-engine operation
 * validity is enforced in `superRefine` against the engine's own operation
 * schema. This keeps every provider (including GitHub Copilot, which rejects
 * top-level `oneOf` tool schemas) happy.
 */
export const nosqlSchema = z
	.object({
		engine: z.enum(["mongodb", "redis"]).describe("mongodb or redis"),
		connection: connectionSchema.optional().describe("Connection config"),
		operation: operationSchema.describe("The operation to execute"),
	})
	.superRefine((data, ctx) => {
		const engineModule = ENGINES[data.engine];
		if (!engineModule) return;
		const opResult = engineModule.operationSchema.safeParse(data.operation);
		if (!opResult.success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["operation"],
				message: `Invalid operation for engine '${data.engine}'`,
			});
		}
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
	schema: nosqlSchema,
});
