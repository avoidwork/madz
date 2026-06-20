import React from "react";
import { Text } from "ink";
import { marked, setOptions } from "marked";
import { markedTerminal } from "marked-terminal";

const terminalRenderer = markedTerminal();
setOptions({ renderer: terminalRenderer.renderer });

/**
 * Parse markdown to ANSI terminal text.
 * @param {string} markdown
 * @returns {string}
 */
// node:coverage ignore next
export function parseMarkdown(markdown) {
	const cached = parseCache.get(markdown);
	if (cached !== undefined) {
		return cached;
	}
	const parsed = marked.parse(markdown).trim();
	parseCache.set(markdown, parsed);
	return parsed;
}

const STREAMING_CURSOR = "\u2588";

/**
 * Maximum number of entries in the LRU parse cache.
 * Balances memory usage (~2-5MB) with high hit rates for
 * repeating markdown patterns in thinking text.
 */
const MAX_CACHE_SIZE = 500;

/**
 * Bounded LRU (Least Recently Used) cache for markdown parsing.
 * Evicts the least recently used entry when the cache is full.
 * @param {number} maxSize - Maximum number of entries (default: 500)
 */
class LRUCache {
	/**
	 * @param {number} maxSize
	 */
	constructor(maxSize = MAX_CACHE_SIZE) {
		this.maxSize = maxSize;
		this.cache = new Map();
		this.hits = 0;
		this.misses = 0;
	}

	/**
	 * Get a value from the cache. Updates LRU order.
	 * @param {string} key
	 * @returns {unknown}
	 */
	get(key) {
		if (!this.cache.has(key)) {
			this.misses++;
			return undefined;
		}
		this.hits++;
		// Move to end (most recently used)
		const value = this.cache.get(key);
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	/**
	 * Set a value in the cache. Evicts LRU entry if full.
	 * @param {string} key
	 * @param {unknown} value
	 */
	set(key, value) {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Evict least recently used (first entry in Map)
			const lruKey = this.cache.keys().next().value;
			this.cache.delete(lruKey);
		}
		this.cache.set(key, value);
	}

	/**
	 * Delete a value from the cache.
	 * @param {string} key
	 * @returns {boolean}
	 */
	delete(key) {
		return this.cache.delete(key);
	}

	/**
	 * Check if a key exists in the cache.
	 * @param {string} key
	 * @returns {boolean}
	 */
	has(key) {
		return this.cache.has(key);
	}

	/**
	 * Current number of entries in the cache.
	 * @returns {number}
	 */
	get size() {
		return this.cache.size;
	}

	/**
	 * Cache hit rate (0-1). Returns 0 if no requests made.
	 * @returns {number}
	 */
	get hitRate() {
		const total = this.hits + this.misses;
		return total === 0 ? 0 : this.hits / total;
	}

	/**
	 * Clear all entries from the cache.
	 */
	clear() {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
	}
}

/**
 * Module-level LRU parse cache keyed by clean content string.
 * Avoids reparsing identical markdown across renders.
 * Bounded at 500 entries with LRU eviction.
 */
const parseCache = new LRUCache(MAX_CACHE_SIZE);

/**
 * Render markdown content as styled terminal text.
 * Strips streaming cursor character before parsing to avoid parser errors.
 * Uses a module-level LRU cache to avoid reparsing identical content.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @returns {React.ReactNode}
 */
export function MarkdownTextInner({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}

	// Strip streaming cursor character before parsing
	const cleanContent = (content || "").replace(new RegExp(STREAMING_CURSOR, "g"), "");

	// Parse with caching (cache is inside parseMarkdown)
	const parsed = parseMarkdown(cleanContent);
	return React.createElement(Text, { color: "white" }, parsed);
}

/**
 * Get cache statistics for debugging.
 * @returns {{ size: number, hitRate: number }}
 */
export function getParseCacheStats() {
	return {
		size: parseCache.size,
		hitRate: parseCache.hitRate,
	};
}

/**
 * Memo-wrapped MarkdownText for rendering in the component tree.
 */
export const MarkdownText = React.memo(MarkdownTextInner);
