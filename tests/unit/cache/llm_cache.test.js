import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createLlmCache, getCacheKey } from "../../src/cache/llm_cache.js";
import { callReactAgent } from "../../src/agent/react.js";

describe("LLM Cache - getCacheKey", () => {
	it("produces consistent hashes for the same threadId and message", () => {
		const key1 = getCacheKey("thread-1", "Hello world");
		const key2 = getCacheKey("thread-1", "Hello world");
		assert.strictEqual(key1, key2);
	});

	it("produces different hashes for different messages", () => {
		const key1 = getCacheKey("thread-1", "Hello world");
		const key2 = getCacheKey("thread-1", "Goodbye world");
		assert.notStrictEqual(key1, key2);
	});

	it("produces different hashes for different threadIds", () => {
		const key1 = getCacheKey("thread-1", "Hello world");
		const key2 = getCacheKey("thread-2", "Hello world");
		assert.notStrictEqual(key1, key2);
	});

	it("includes threadId in the key format", () => {
		const key = getCacheKey("my-thread", "message");
		assert.ok(key.startsWith("my-thread_"));
	});

	it("hash is a hex string of consistent length", () => {
		const key = getCacheKey("thread-1", "Hello world");
		const parts = key.split("_");
		assert.strictEqual(parts.length, 2);
		// SHA-256 produces 64 hex characters
		assert.strictEqual(parts[1].length, 64);
		assert.ok(/^[0-9a-f]+$/.test(parts[1]));
	});
});

describe("LLM Cache - createLlmCache", () => {
	let cache;

	beforeEach(() => {
		cache = createLlmCache(3, 600000);
	});

	it("returns null on cache miss", () => {
		const result = cache.get("nonexistent-key");
		assert.strictEqual(result, null);
	});

	it("stores and retrieves values", () => {
		cache.set("key-1", "value-1");
		const result = cache.get("key-1");
		assert.strictEqual(result, "value-1");
	});

	it("overwrites existing values for the same key", () => {
		cache.set("key-1", "value-1");
		cache.set("key-1", "value-2");
		const result = cache.get("key-1");
		assert.strictEqual(result, "value-2");
	});

	it("stores multiple keys independently", () => {
		cache.set("key-1", "value-1");
		cache.set("key-2", "value-2");
		cache.set("key-3", "value-3");
		assert.strictEqual(cache.get("key-1"), "value-1");
		assert.strictEqual(cache.get("key-2"), "value-2");
		assert.strictEqual(cache.get("key-3"), "value-3");
	});

	it("evicts least recently used entry when full", () => {
		cache.set("key-1", "value-1");
		cache.set("key-2", "value-2");
		cache.set("key-3", "value-3");
		// Cache is now full (size=3)
		// Access key-1 to make it recently used
		cache.get("key-1");
		// Add a new entry — should evict key-2 (least recently used)
		cache.set("key-4", "value-4");
		assert.strictEqual(cache.get("key-1"), "value-1");
		assert.strictEqual(cache.get("key-2"), null);
		assert.strictEqual(cache.get("key-3"), "value-3");
		assert.strictEqual(cache.get("key-4"), "value-4");
	});

	it("evicts most recently used entry when not accessed", () => {
		cache.set("key-1", "value-1");
		cache.set("key-2", "value-2");
		cache.set("key-3", "value-3");
		// Cache is full, all entries are equally old
		// Add a new entry — should evict key-1 (first inserted, not accessed)
		cache.set("key-4", "value-4");
		assert.strictEqual(cache.get("key-1"), null);
		assert.strictEqual(cache.get("key-2"), "value-2");
		assert.strictEqual(cache.get("key-3"), "value-3");
		assert.strictEqual(cache.get("key-4"), "value-4");
	});

	it("resets LRU order on set (not just get)", () => {
		cache.set("key-1", "value-1");
		cache.set("key-2", "value-2");
		cache.set("key-3", "value-3");
		// Re-set key-1 to make it recently used
		cache.set("key-1", "value-1-updated");
		// Add a new entry — should evict key-2
		cache.set("key-4", "value-4");
		assert.strictEqual(cache.get("key-1"), "value-1-updated");
		assert.strictEqual(cache.get("key-2"), null);
		assert.strictEqual(cache.get("key-3"), "value-3");
		assert.strictEqual(cache.get("key-4"), "value-4");
	});

	it("fail-open: cache errors don't throw on get", () => {
		// Simulate a corrupted cache by replacing the internal lru
		const originalLru = cache._lru;
		cache._lru.get = () => {
			throw new Error("Simulated cache error");
		};
		assert.doesNotThrow(() => {
			const result = cache.get("any-key");
			assert.strictEqual(result, null);
		});
		// Restore
		cache._lru = originalLru;
	});

	it("fail-open: cache errors don't throw on set", () => {
		const originalLru = cache._lru;
		cache._lru.set = () => {
			throw new Error("Simulated cache error");
		};
		assert.doesNotThrow(() => {
			cache.set("any-key", "any-value");
		});
		// Restore
		cache._lru = originalLru;
	});

	it("stores and retrieves complex objects", () => {
		const obj = { content: "Hello", metadata: { tokens: 42 } };
		cache.set("obj-key", obj);
		const result = cache.get("obj-key");
		assert.deepStrictEqual(result, obj);
	});
});

describe("LLM Cache - TTL expiration", () => {
	it("returns null for expired entries", async () => {
		const cache = createLlmCache(10, 50); // 50ms TTL
		cache.set("key-1", "value-1");
		assert.strictEqual(cache.get("key-1"), "value-1");
		// Wait for TTL to expire
		await new Promise((resolve) => setTimeout(resolve, 100));
		assert.strictEqual(cache.get("key-1"), null);
	});

	it("returns cached value before TTL expires", async () => {
		const cache = createLlmCache(10, 500); // 500ms TTL
		cache.set("key-1", "value-1");
		await new Promise((resolve) => setTimeout(resolve, 100));
		assert.strictEqual(cache.get("key-1"), "value-1");
	});
});

describe("LLM Cache - Integration with callReactAgent", () => {
	it("returns cached response on second call with same threadId and message", async () => {
		let invokeCount = 0;
		const mockAgent = {
			invoke: async () => {
				invokeCount++;
				return {
					messages: [{ type: "ai", content: `Response ${invokeCount}` }],
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };

		// First call — should invoke the agent
		await callReactAgent(mockAgent, "Hello", config);
		assert.strictEqual(invokeCount, 1);

		// Second call with same threadId and message — should return cached
		await callReactAgent(mockAgent, "Hello", config);
		assert.strictEqual(invokeCount, 1); // Agent should NOT be called again
	});

	it("does not cache when thread_id is missing", async () => {
		let invokeCount = 0;
		const mockAgent = {
			invoke: async () => {
				invokeCount++;
				return {
					messages: [{ type: "ai", content: `Response ${invokeCount}` }],
				};
			},
		};

		const config = {}; // No thread_id

		await callReactAgent(mockAgent, "Hello", config);
		await callReactAgent(mockAgent, "Hello", config);
		assert.strictEqual(invokeCount, 2); // Agent should be called both times
	});

	it("uses different cache keys for different messages", async () => {
		let invokeCount = 0;
		const mockAgent = {
			invoke: async () => {
				invokeCount++;
				return {
					messages: [{ type: "ai", content: `Response ${invokeCount}` }],
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };

		await callReactAgent(mockAgent, "Message A", config);
		await callReactAgent(mockAgent, "Message B", config);
		await callReactAgent(mockAgent, "Message A", config);

		// First and third calls should share cache, second call is different
		assert.strictEqual(invokeCount, 2);
	});

	it("uses different cache keys for different threadIds", async () => {
		let invokeCount = 0;
		const mockAgent = {
			invoke: async () => {
				invokeCount++;
				return {
					messages: [{ type: "ai", content: `Response ${invokeCount}` }],
				};
			},
		};

		const config1 = { configurable: { thread_id: "thread-1" } };
		const config2 = { configurable: { thread_id: "thread-2" } };

		await callReactAgent(mockAgent, "Hello", config1);
		await callReactAgent(mockAgent, "Hello", config2);
		await callReactAgent(mockAgent, "Hello", config1);

		// thread-1 calls share cache, thread-2 is separate
		assert.strictEqual(invokeCount, 2);
	});

	it("does not cache when tools are used", async () => {
		let invokeCount = 0;
		const mockAgent = {
			invoke: async () => {
				invokeCount++;
				return {
					messages: [{ 
						type: "ai", 
						content: `Response ${invokeCount}`,
						tool_calls: [{ name: "test_tool", args: {} }]
					}],
				};
			},
		};

		const config = { configurable: { thread_id: "test-thread" } };

		// First call — should invoke the agent
		await callReactAgent(mockAgent, "Hello", config);
		assert.strictEqual(invokeCount, 1);

		// Second call with same threadId and message — should NOT return cached because tools were used
		await callReactAgent(mockAgent, "Hello", config);
		assert.strictEqual(invokeCount, 2); // Agent should be called again
	});
});