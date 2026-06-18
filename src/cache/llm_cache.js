import { lru } from "tiny-lru";
import { createHash } from "node:crypto";

/**
 * Generate a cache key from threadId and message content.
 * @param {string} threadId - The thread identifier
 * @param {string} message - The message content to hash
 * @returns {string} Cache key in format `${threadId}_${hash}`
 */
export function getCacheKey(threadId, message) {
	const hash = createHash("sha256").update(message).digest("hex");
	return `${threadId}_${hash}`;
}

/**
 * Create an LLM response cache instance.
 * @param {number} size - Maximum number of cached entries
 * @param {number} ttl - Time-to-live in milliseconds
 * @returns {Object} Cache instance with get, set, and internal lru reference
 */
export function createLlmCache(size, ttl) {
	const cache = lru(size, ttl);
	return {
		get(key) {
			try {
				return cache.get(key);
			} catch {
				return null;
			}
		},
		set(key, value) {
			try {
				cache.set(key, value);
			} catch {
				// Fail-open: silently ignore cache write errors
			}
		},
		clear() {
			try {
				cache.clear();
			} catch {
				// Fail-open: silently ignore cache clear errors
			}
		},
		_lru: cache,
	};
}