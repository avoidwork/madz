/**
 * Pure loop checks over accumulated stream text. They look at the text itself,
 * never at how the provider happened to split it into deltas, so a repeat is
 * found however each copy was chunked. Kept free of I/O so the worker thread
 * and the unit tests run the exact same code.
 */

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+|\n+/;

/**
 * Split text into completed sentences. A sentence ends at `.`, `?` or `!`
 * followed by whitespace, or at a newline. The trailing piece has not ended
 * yet, so it is dropped.
 * @param {string} text - Accumulated stream text
 * @returns {string[]} Completed sentences, whitespace collapsed
 */
export function completedSentences(text) {
	const parts = text.split(SENTENCE_BOUNDARY);
	parts.pop();
	const out = [];
	for (const part of parts) {
		const sentence = part.replace(/\s+/g, " ").trim();
		if (sentence) out.push(sentence);
	}
	return out;
}

/**
 * Look for a sentence that repeats within the last `windowSize` completed
 * sentences.
 * @param {string} text - Accumulated stream text
 * @param {number} windowSize - How many recent sentences to compare
 * @param {number} threshold - Occurrences above which a sentence is looping
 * @returns {boolean} True when a sentence occurs more than `threshold` times
 */
export function hasDuplicateSentence(text, windowSize, threshold) {
	const counts = new Map();
	for (const sentence of completedSentences(text).slice(-windowSize)) {
		const count = (counts.get(sentence) ?? 0) + 1;
		if (count > threshold) return true;
		counts.set(sentence, count);
	}
	return false;
}

/**
 * Look for a run of words repeated back-to-back at the end of the text. This
 * covers loops with no sentence terminator at all, such as "ok ok ok ok".
 * @param {string} text - Accumulated stream text
 * @param {number} threshold - Back-to-back repeats above which a loop is flagged
 * @returns {boolean} True when the tail is one word run repeated more than `threshold` times
 */
export function hasRepeatedWords(text, threshold) {
	const words = text.split(/\s+/).filter(Boolean);
	const needed = threshold + 1;
	const n = words.length;
	const last = words[n - 1];
	for (let period = 1; period * needed <= n; period++) {
		// Cheap reject: the unit's last word must recur exactly one period back.
		if (words[n - 1 - period] !== last) continue;
		let match = true;
		for (let i = 1; i < period * (needed - 1) && match; i++) {
			if (words[n - 1 - i] !== words[n - 1 - i - period]) match = false;
		}
		if (match) return true;
	}
	return false;
}

/**
 * Check accumulated stream text for a loop.
 * @param {string} text - Accumulated stream text
 * @param {Object} options - Options
 * @param {number} options.windowSize - Recent completed sentences to compare
 * @param {number} options.threshold - Repeats above which a loop is flagged
 * @returns {boolean} True when the text is looping
 */
export function checkLoop(text, { windowSize, threshold }) {
	return hasDuplicateSentence(text, windowSize, threshold) || hasRepeatedWords(text, threshold);
}
