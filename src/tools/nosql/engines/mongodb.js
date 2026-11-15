/**
 * MongoDB engine for the NoSQL tool.
 * Uses the official `mongodb` driver (v7.x).
 * @module tools/nosql/engines/mongodb
 */

import { z } from "zod";
import { MongoClient } from "mongodb";

/** Lazily created MongoClient instance. */
let client;

/** Default operation timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Get the MongoClient, creating it lazily on first use.
 * @param {object} connection - Connection config
 * @param {object} [options] - Runtime options
 * @param {import("mongodb").MongoClient} [options.client] - Injected client (used in tests)
 * @returns {import("mongodb").MongoClient} The MongoClient instance
 */
function getClient(connection, options = {}) {
	if (options.client) {
		return options.client;
	}
	if (!client) {
		const connectionString = connection.connectionString || undefined;
		const credentials = connection.credentials || {};
		const clientOptions = {
			serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS,
		};
		client = connectionString
			? new MongoClient(connectionString, clientOptions)
			: new MongoClient(
					{
						host: connection.host || "localhost",
						port: connection.port || 27017,
						user: credentials.username || undefined,
						password: credentials.password || undefined,
					},
					clientOptions,
				);
	}
	return client;
}

/**
 * Execute a MongoDB operation.
 * @param {object} input - Tool input
 * @param {object} input.connection - Connection config
 * @param {object} input.operation - The operation to execute
 * @returns {Promise<object>} Result of the operation
 */
export async function execute(input, options = {}) {
	const { connection = {}, operation = {} } = input;
	const {
		op,
		collection,
		filter = {},
		update = {},
		document = {},
		documents = [],
		pipeline = [],
		options: opOptions = {},
	} = operation;

	try {
		const client = getClient(connection, options);
		await client.connect();
		const database = connection.credentials?.database || "test";
		const db = client.db(database);
		const col = db.collection(collection);

		switch (op) {
			case "find": {
				const cursor = col.find(filter, opOptions);
				const docs = await cursor.toArray();
				return { ok: true, count: docs.length, documents: docs };
			}
			case "findOne": {
				const doc = await col.findOne(filter, opOptions);
				return { ok: true, document: doc };
			}
			case "insertOne": {
				const result = await col.insertOne(document);
				return { ok: true, insertedId: result.insertedId };
			}
			case "insertMany": {
				const result = await col.insertMany(documents);
				return { ok: true, insertedCount: result.insertedCount, insertedIds: result.insertedIds };
			}
			case "updateOne": {
				const result = await col.updateOne(filter, update, opOptions);
				return { ok: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
			}
			case "updateMany": {
				const result = await col.updateMany(filter, update, opOptions);
				return { ok: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
			}
			case "deleteOne": {
				const result = await col.deleteOne(filter);
				return { ok: true, deletedCount: result.deletedCount };
			}
			case "deleteMany": {
				const result = await col.deleteMany(filter);
				return { ok: true, deletedCount: result.deletedCount };
			}
			case "aggregate": {
				const cursor = col.aggregate(pipeline, opOptions);
				const docs = await cursor.toArray();
				return { ok: true, count: docs.length, documents: docs };
			}
			case "countDocuments": {
				const count = await col.countDocuments(filter, opOptions);
				return { ok: true, count };
			}
			default:
				return {
					ok: false,
					error: `Unsupported MongoDB operation: '${op}'`,
					kind: "invalid-operation",
				};
		}
	} catch (err) {
		return {
			ok: false,
			error: `MongoDB operation failed: ${err.message}`,
			kind: "operation-failed",
		};
	}
}

/**
 * Close the MongoDB client connection.
 * @returns {Promise<void>} Resolves when the connection is closed
 */
export async function close() {
	if (client) {
		await client.close();
		client = undefined;
	}
}

/** Engine identifier. */
export const name = "mongodb";

/** Connection config schema for MongoDB. */
export const connectionSchema = z.object({
	connectionString: z.string().optional().default(""),
	host: z.string().optional().default(""),
	port: z.number().int().positive().default(27017),
	credentials: z
		.object({
			username: z.string().optional().default(""),
			password: z.string().optional().default(""),
			database: z.string().optional().default(""),
		})
		.optional()
		.default({}),
});

/** Operation schema for MongoDB. */
export const operationSchema = z.object({
	op: z.enum([
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
	]),
	collection: z.string().min(1),
	filter: z.record(z.unknown()).optional().default({}),
	update: z.record(z.unknown()).optional().default({}),
	document: z.record(z.unknown()).optional().default({}),
	documents: z.array(z.record(z.unknown())).optional().default([]),
	pipeline: z.array(z.record(z.unknown())).optional().default([]),
	options: z.record(z.unknown()).optional().default({}),
});
