/**
 * File list cache for TUI file path autocomplete.
 * Uses tiny-lru for TTL-based caching of scanned file lists.
 */
import { lru } from "tiny-lru";

/**
 * FileCache class — caches file lists with configurable TTL.
 * Provides warm-up, invalidation, and retrieval.
 */
export class FileCache {
	/**
	 * @param {Object} [options]
	 * @param {number} [options.ttl] - Time-to-live in milliseconds (default: 30000)
	 * @param {number} [options.max] - Maximum number of entries (default: 10)
	 */
	constructor({ ttl = 30000, max = 10 } = {}) {
		this.ttl = ttl;
		this.lru = lru({ ttl, max });
		this.warmPromise = null;
	}

	/**
	 * Get cached file list if available and not expired.
	 * @returns {string[]|null} Cached file list or null
	 */
	get() {
		return this.lru.get("files") ?? null;
	}

	/**
	 * Set the cached file list.
	 * @param {string[]} files - File list to cache
	 */
	set(files) {
		this.lru.set("files", files);
	}

	/**
	 * Invalidate the cache.
	 */
	invalidate() {
		this.lru.clear();
	}

	/**
	 * Warm up the cache by pre-loading a file list.
	 * @param {Promise<string[]>} filesPromise - Promise resolving to file list
	 * @returns {Promise<string[]>}
	 */
	async warmUp(filesPromise) {
		this.warmPromise = filesPromise;
		try {
			const files = await filesPromise;
			this.set(files);
			return files;
		} catch (err) {
			this.warmPromise = null;
			throw err;
		}
	}

	/**
	 * Get the file list, using cache if available, otherwise warm up.
	 * @param {() => Promise<string[]>} scanFn - Function to scan files
	 * @returns {Promise<string[]>}
	 */
	async getOrWarm(scanFn) {
		const cached = this.get();
		if (cached) return cached;

		if (this.warmPromise) {
			return this.warmPromise;
		}

		return this.warmUp(scanFn());
	}
}
