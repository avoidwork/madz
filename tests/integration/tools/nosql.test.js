/**
 * Integration tests for the NoSQL tool.
 * Runs operations against in-memory MongoDB and Redis mocks.
 * @see {@link src/tools/nosql/index.js}
 */

import { describe, it, after } from "node:test";
import assert from "node:assert";
import { nosqlImpl, closeAll } from "../../../src/tools/nosql/index.js";

/**
 * Minimal in-memory Redis mock that mirrors the ioredis methods the redis
 * engine uses. Kept small and focused on the tested operations.
 */
function createRedisMock() {
	const strings = new Map();
	const hashes = new Map();
	const lists = new Map();

	return {
		async get(key) {
			return strings.has(key) ? strings.get(key) : null;
		},
		async set(key, value) {
			strings.set(key, String(value));
			return "OK";
		},
		async hset(key, field, value) {
			if (!hashes.has(key)) hashes.set(key, new Map());
			hashes.get(key).set(field, String(value));
			return 1;
		},
		async hget(key, field) {
			const hash = hashes.get(key);
			return hash ? (hash.get(field) ?? null) : null;
		},
		async hgetall(key) {
			const hash = hashes.get(key);
			if (!hash) return {};
			return Object.fromEntries(hash);
		},
		async lpush(key, ...values) {
			if (!lists.has(key)) lists.set(key, []);
			const list = lists.get(key);
			for (const value of values) {
				list.unshift(String(value));
			}
			return list.length;
		},
		async lrange(key, start, stop) {
			const list = lists.get(key) || [];
			const end = stop < 0 ? list.length + stop : stop;
			return list.slice(start, end + 1);
		},
		async del(...keys) {
			let deleted = 0;
			for (const key of keys) {
				if (strings.delete(key) || hashes.delete(key) || lists.delete(key)) {
					deleted++;
				}
			}
			return deleted;
		},
		async expire(key, _seconds) {
			// No-op for the in-memory mock; returns 1 if the key exists.
			return strings.has(key) || hashes.has(key) || lists.has(key) ? 1 : 0;
		},
		async exists(key) {
			return strings.has(key) || hashes.has(key) || lists.has(key) ? 1 : 0;
		},
		async keys(pattern) {
			const all = [...strings.keys(), ...hashes.keys(), ...lists.keys()];
			if (pattern === "*") return all;
			const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
			return all.filter((key) => regex.test(key));
		},
		async quit() {
			return "OK";
		},
	};
}

/**
 * Minimal in-memory MongoDB mock that mirrors the driver methods the
 * mongodb engine uses. Kept small and focused on the tested operations.
 */
function createMongoMock() {
	const collections = new Map();

	function getCollection(name) {
		if (!collections.has(name)) {
			collections.set(name, []);
		}
		return collections.get(name);
	}

	const collection = (name) => {
		const docs = getCollection(name);
		return {
			find: (filter = {}) => {
				const results = docs.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
				return {
					toArray: async () => results,
				};
			},
			findOne: async (filter = {}) =>
				docs.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v)) || null,
			insertOne: async (doc) => {
				const insertedId = docs.length + 1;
				docs.push({ ...doc, _id: insertedId });
				return { insertedId };
			},
			insertMany: async (documents) => {
				let insertedCount = 0;
				for (const doc of documents) {
					docs.push({ ...doc, _id: docs.length + 1 });
					insertedCount++;
				}
				return { insertedCount };
			},
			updateOne: async (filter, update) => {
				const idx = docs.findIndex((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
				if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
				docs[idx] = { ...docs[idx], ...update.$set };
				return { matchedCount: 1, modifiedCount: 1 };
			},
			updateMany: async (filter, update) => {
				let matchedCount = 0;
				for (const d of docs) {
					if (Object.entries(filter).every(([k, v]) => d[k] === v)) {
						Object.assign(d, update.$set);
						matchedCount++;
					}
				}
				return { matchedCount, modifiedCount: matchedCount };
			},
			deleteOne: async (filter) => {
				const idx = docs.findIndex((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
				if (idx === -1) return { deletedCount: 0 };
				docs.splice(idx, 1);
				return { deletedCount: 1 };
			},
			deleteMany: async (filter) => {
				let deletedCount = 0;
				for (let i = docs.length - 1; i >= 0; i--) {
					if (Object.entries(filter).every(([k, v]) => docs[i][k] === v)) {
						docs.splice(i, 1);
						deletedCount++;
					}
				}
				return { deletedCount };
			},
			aggregate: (pipeline) => {
				let results = [...docs];
				for (const stage of pipeline) {
					if (stage.$match) {
						results = results.filter((d) =>
							Object.entries(stage.$match).every(([k, v]) => d[k] === v),
						);
					}
				}
				return { toArray: async () => results };
			},
			countDocuments: async (filter = {}) =>
				docs.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v)).length,
		};
	};

	return {
		db: () => ({ collection }),
		connect: async () => {},
		close: async () => {},
	};
}

describe("tools - nosql integration", () => {
	after(async () => {
		await closeAll();
	});

	describe("MongoDB", () => {
		it("inserts and finds a document", async () => {
			const client = createMongoMock();
			const insert = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "insertOne", collection: "users", document: { name: "alice", age: 30 } },
				},
				{ client },
			);
			assert.strictEqual(insert.ok, true);
			assert.ok(insert.insertedId);

			const find = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "find", collection: "users", filter: { name: "alice" } },
				},
				{ client },
			);
			assert.strictEqual(find.ok, true);
			assert.strictEqual(find.count, 1);
			assert.strictEqual(find.documents[0].name, "alice");
		});

		it("finds a single document", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "insertOne", collection: "users", document: { name: "bob", age: 25 } },
				},
				{ client },
			);
			const findOne = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "findOne", collection: "users", filter: { name: "bob" } },
				},
				{ client },
			);
			assert.strictEqual(findOne.ok, true);
			assert.strictEqual(findOne.document.name, "bob");
		});

		it("inserts many documents", async () => {
			const client = createMongoMock();
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "insertMany",
						collection: "users",
						documents: [{ name: "x" }, { name: "y" }],
					},
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.insertedCount, 2);
		});

		it("updates a single document", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "insertOne", collection: "users", document: { name: "carol", age: 40 } },
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "updateOne",
						collection: "users",
						filter: { name: "carol" },
						update: { $set: { age: 41 } },
					},
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.matchedCount, 1);
			assert.strictEqual(result.modifiedCount, 1);
		});

		it("updates many documents", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "insertMany",
						collection: "users",
						documents: [
							{ name: "d", active: true },
							{ name: "e", active: true },
						],
					},
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "updateMany",
						collection: "users",
						filter: { active: true },
						update: { $set: { active: false } },
					},
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.matchedCount, 2);
		});

		it("deletes a single document", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "insertOne", collection: "users", document: { name: "f" } },
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "deleteOne", collection: "users", filter: { name: "f" } },
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.deletedCount, 1);
		});

		it("deletes many documents", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "insertMany",
						collection: "users",
						documents: [
							{ name: "g", t: 1 },
							{ name: "h", t: 1 },
						],
					},
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "deleteMany", collection: "users", filter: { t: 1 } },
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.deletedCount, 2);
		});

		it("runs an aggregate pipeline", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "insertOne",
						collection: "users",
						document: { name: "i", city: "ottawa" },
					},
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: {
						op: "aggregate",
						collection: "users",
						pipeline: [{ $match: { city: "ottawa" } }],
					},
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.count, 1);
		});

		it("counts documents", async () => {
			const client = createMongoMock();
			await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "insertOne", collection: "users", document: { name: "j" } },
				},
				{ client },
			);
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "countDocuments", collection: "users", filter: {} },
				},
				{ client },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.count, 1);
		});

		it("returns an empty result set for no matches", async () => {
			const client = createMongoMock();
			const find = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "find", collection: "users", filter: { name: "nobody" } },
				},
				{ client },
			);
			assert.strictEqual(find.ok, true);
			assert.strictEqual(find.count, 0);
			assert.deepStrictEqual(find.documents, []);
		});

		it("rejects an unsupported operation", async () => {
			const client = createMongoMock();
			const result = await nosqlImpl(
				{
					engine: "mongodb",
					connection: { credentials: { database: "test" } },
					operation: { op: "bogus", collection: "users" },
				},
				{ client },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-operation");
		});
	});

	describe("Redis", () => {
		it("sets and gets a value", async () => {
			const client = createRedisMock();
			const set = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "set", key: "foo", value: "bar" },
				},
				{ client },
			);
			assert.strictEqual(set.ok, true);

			const get = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "get", key: "foo" },
				},
				{ client },
			);
			assert.strictEqual(get.ok, true);
			assert.strictEqual(get.value, "bar");
		});

		it("handles hash operations", async () => {
			const client = createRedisMock();
			await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "hset", key: "user:1", field: "name", value: "alice" },
				},
				{ client },
			);
			const hget = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "hget", key: "user:1", field: "name" },
				},
				{ client },
			);
			assert.strictEqual(hget.ok, true);
			assert.strictEqual(hget.value, "alice");

			const hgetall = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "hgetall", key: "user:1" },
				},
				{ client },
			);
			assert.strictEqual(hgetall.ok, true);
			assert.strictEqual(hgetall.value.name, "alice");
		});

		it("handles list operations", async () => {
			const client = createRedisMock();
			await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "lpush", key: "list", values: ["a", "b", "c"] },
				},
				{ client },
			);
			const lrange = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "lrange", key: "list", start: 0, stop: -1 },
				},
				{ client },
			);
			assert.strictEqual(lrange.ok, true);
			assert.ok(Array.isArray(lrange.values));
		});

		it("handles del, expire, exists, and keys", async () => {
			const client = createRedisMock();
			await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "set", key: "k1", value: "v1" },
				},
				{ client },
			);
			const exists = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "exists", key: "k1" },
				},
				{ client },
			);
			assert.strictEqual(exists.ok, true);

			const expire = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "expire", key: "k1", seconds: 100 },
				},
				{ client },
			);
			assert.strictEqual(expire.ok, true);

			const keys = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "keys", pattern: "*" },
				},
				{ client },
			);
			assert.strictEqual(keys.ok, true);
			assert.ok(Array.isArray(keys.keys));

			const del = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "del", keys: ["k1"] },
				},
				{ client },
			);
			assert.strictEqual(del.ok, true);
		});

		it("rejects an unsupported operation", async () => {
			const client = createRedisMock();
			const result = await nosqlImpl(
				{
					engine: "redis",
					connection: { host: "localhost", port: 6379 },
					operation: { op: "bogus", key: "foo" },
				},
				{ client },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-operation");
		});
	});

	it("rejects an unsupported engine", async () => {
		const result = await nosqlImpl({ engine: "bogus" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "invalid-engine");
	});
});
