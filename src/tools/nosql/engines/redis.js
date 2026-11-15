/**
 * Redis engine for the NoSQL tool.
 * Uses the `ioredis` client (v6.x).
 * @module tools/nosql/engines/redis
 */

import { z } from "zod";
import Redis from "ioredis";

/** Lazily created Redis instance. */
let redis;

/**
 * Get the Redis client, creating it lazily on first use.
 * @param {object} connection - Connection config
 * @param {object} [options] - Runtime options
 * @param {import("ioredis").Redis} [options.client] - Injected client (used in tests)
 * @returns {import("ioredis").Redis} The Redis client instance
 */
function getClient(connection, options = {}) {
	if (options.client) {
		return options.client;
	}
	if (!redis) {
		const credentials = connection.credentials || {};
		redis = new Redis({
			host: connection.host || "localhost",
			port: connection.port || 6379,
			password: credentials.password || undefined,
			db: connection.db || 0,
			username: credentials.username || undefined,
		});
		redis.on("error", () => {
			// Swallow connection errors; operations surface them via the result.
		});
	}
	return redis;
}

/**
 * Execute a Redis operation.
 * @param {object} input - Tool input
 * @param {object} input.connection - Connection config
 * @param {object} input.operation - The operation to execute
 * @returns {Promise<object>} Result of the operation
 */
export async function execute(input, options = {}) {
	const { connection = {}, operation = {} } = input;
	const {
		op,
		key,
		field,
		value,
		values = [],
		start,
		stop,
		seconds,
		pattern,
		keys = [],
	} = operation;

	try {
		const client = getClient(connection, options);

		switch (op) {
			case "get": {
				const result = await client.get(key);
				return { ok: true, value: result };
			}
			case "set": {
				await client.set(key, value);
				return { ok: true };
			}
			case "hget": {
				const result = await client.hget(key, field);
				return { ok: true, value: result };
			}
			case "hset": {
				await client.hset(key, field, value);
				return { ok: true };
			}
			case "hgetall": {
				const result = await client.hgetall(key);
				return { ok: true, value: result };
			}
			case "lpush": {
				const result = await client.lpush(key, ...values);
				return { ok: true, length: result };
			}
			case "lrange": {
				const result = await client.lrange(key, start, stop);
				return { ok: true, values: result };
			}
			case "del": {
				const result = await client.del(...keys);
				return { ok: true, deleted: result };
			}
			case "expire": {
				const result = await client.expire(key, seconds);
				return { ok: true, result };
			}
			case "exists": {
				const result = await client.exists(key);
				return { ok: true, result };
			}
			case "keys": {
				const result = await client.keys(pattern);
				return { ok: true, keys: result };
			}
			default:
				return {
					ok: false,
					error: `Unsupported Redis operation: '${op}'`,
					kind: "invalid-operation",
				};
		}
	} catch (err) {
		return { ok: false, error: `Redis operation failed: ${err.message}`, kind: "operation-failed" };
	}
}

/**
 * Close the Redis client connection.
 * @returns {Promise<void>} Resolves when the connection is closed
 */
export async function close() {
	if (redis) {
		await redis.quit();
		redis = undefined;
	}
}

/** Engine identifier. */
export const name = "redis";

/** Connection config schema for Redis. */
export const connectionSchema = z.object({
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(6379),
	credentials: z
		.object({
			username: z.string().optional().default(""),
			password: z.string().optional().default(""),
		})
		.optional()
		.default({}),
	db: z.number().int().nonnegative().default(0),
});

/** Operation schema for Redis. */
export const operationSchema = z.object({
	op: z.enum([
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
	]),
	key: z.string().optional(),
	field: z.string().optional(),
	value: z.union([z.string(), z.number()]).optional(),
	values: z
		.array(z.union([z.string(), z.number()]))
		.optional()
		.default([]),
	start: z.number().int().optional(),
	stop: z.number().int().optional(),
	seconds: z.number().int().optional(),
	pattern: z.string().optional(),
	keys: z.array(z.string()).optional().default([]),
});
