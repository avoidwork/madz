/**
 * Pure loop checks. They work on already-split words, never on the raw stream,
 * so how the provider cut the stream into deltas does not matter, and the cost
 * of a check depends on the window, not on how long the stream has been
 * running. Kept free of I/O so the worker thread and the unit tests run the
 * exact same code.
 *
 * A loop is a short word chain (3-4 words) that recurs across the stream more
 * than `threshold` times. This catches a model that keeps rephrasing the same
 * thought in different sentences across multiple paragraphs — the chains
 * repeat even though no whole sentence is identical. It is deliberately simple:
 * no fuzzy or garbled matching, no sentence-level comparison.
 */

/**
 * Take the words that have completed once `delta` is appended. A word ends at
 * whitespace; a trailing piece with no whitespace after it may continue in the
 * next delta, so it is carried forward.
 * @param {string} partial - Unfinished word carried from the previous delta
 * @param {string} delta - New text
 * @returns {{ words: string[], rest: string }} Completed words and the unfinished remainder
 */
export function takeWords(partial, delta) {
	const text = partial + delta;
	const parts = text.split(/\s+/);
	const rest = /\s$/.test(text) ? "" : parts.pop();
	return { words: parts.filter(Boolean), rest };
}

/**
 * Normalize a word into a canonical token: lowercase and strip punctuation.
 * Used so that "read," and "read" count as the same token, and so that words
 * with no letters or digits (`});`, `|`, `---`) are dropped.
 * @param {string} word - The word to normalize
 * @returns {string} The normalized token
 */
export function normalize(word) {
	return word
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Look for a word chain of length `minChain`..`maxChain` that recurs more than
 * `threshold` times anywhere in `words`. Chains are compared as exact normalized
 * token sequences, so they are found across sentence and paragraph boundaries,
 * not just back-to-back at the tail. Words with no letters or digits are
 * dropped, as they are structure, not content.
 * @param {string[]} words - The recent completed words
 * @param {number} threshold - Occurrences above which a chain is looping
 * @param {number} [minChain=3] - Shortest chain length to detect
 * @param {number} [maxChain=4] - Longest chain length to detect
 * @returns {boolean} True when a chain recurs more than `threshold` times
 */
export function hasRepeatedChain(words, threshold, minChain = 3, maxChain = 4) {
	const tokens = words.map(normalize).filter(Boolean);
	for (let n = minChain; n <= maxChain; n++) {
		const counts = new Map();
		for (let i = 0; i + n <= tokens.length; i++) {
			const key = tokens.slice(i, i + n).join(" ");
			const count = (counts.get(key) ?? 0) + 1;
			if (count > threshold) return true;
			counts.set(key, count);
		}
	}
	return false;
}

/**
 * Check the recent words for a loop.
 * @param {Object} task - The check
 * @param {string[]} task.words - Recent completed words
 * @param {number} task.threshold - Occurrences above which a chain is looping
 * @param {number} [task.minChain=3] - Shortest chain length to detect
 * @param {number} [task.maxChain=4] - Longest chain length to detect
 * @returns {boolean} True when the stream is looping
 */
export function checkLoop({ words, threshold, minChain = 3, maxChain = 4 }) {
	return hasRepeatedChain(words, threshold, minChain, maxChain);
}
