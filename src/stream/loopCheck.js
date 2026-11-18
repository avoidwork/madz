/**
 * Pure loop checks. They work on already-split sentences and words, never on
 * the raw stream, so how the provider cut the stream into deltas does not
 * matter, and the cost of a check depends on the window, not on how long the
 * stream has been running. Kept free of I/O so the worker thread and the unit
 * tests run the exact same code.
 */

/**
 * Take the sentences that have completed in `pending`. A sentence ends at `.`,
 * `?` or `!` followed by whitespace, or at a newline. Only the text from `from`
 * on is scanned, so a caller that appends a delta and passes the old length
 * pays for the delta, not for everything seen so far.
 * @param {string} pending - Text not yet consumed (an unfinished sentence plus new text)
 * @param {number} [from=0] - Index to start scanning at (the length before the new text was appended)
 * @returns {{ sentences: string[], rest: string }} Completed sentences (whitespace collapsed)
 *   and the unfinished remainder to carry forward
 */
export function takeSentences(pending, from = 0) {
	const boundary = /(?<=[.!?])\s+|\n+/g;
	boundary.lastIndex = from;
	const sentences = [];
	let start = 0;
	let match;
	while ((match = boundary.exec(pending)) !== null) {
		const sentence = pending.slice(start, match.index).replace(/\s+/g, " ").trim();
		if (sentence) sentences.push(sentence);
		start = match.index + match[0].length;
	}
	return { sentences, rest: pending.slice(start) };
}

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
 * Look for a sentence that occurs more than `threshold` times in `sentences`.
 * @param {string[]} sentences - The recent completed sentences
 * @param {number} threshold - Occurrences above which a sentence is looping
 * @returns {boolean} True when a sentence repeats
 */
export function hasDuplicateSentence(sentences, threshold) {
	const counts = new Map();
	for (const sentence of sentences) {
		const count = (counts.get(sentence) ?? 0) + 1;
		if (count > threshold) return true;
		counts.set(sentence, count);
	}
	return false;
}

/**
 * Look for a run of words repeated back-to-back at the end of `words`. This
 * covers loops with no sentence terminator at all, such as "ok ok ok ok".
 * @param {string[]} words - The recent completed words
 * @param {number} threshold - Back-to-back repeats above which a loop is flagged
 * @returns {boolean} True when the tail is one word run repeated more than `threshold` times
 */
export function hasRepeatedWords(words, threshold) {
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
 * Check the recent sentences and words for a loop.
 * @param {Object} task - The check
 * @param {string[]} task.sentences - Recent completed sentences
 * @param {string[]} task.words - Recent completed words
 * @param {number} task.threshold - Repeats above which a loop is flagged
 * @returns {boolean} True when the stream is looping
 */
export function checkLoop({ sentences, words, threshold }) {
	return hasDuplicateSentence(sentences, threshold) || hasRepeatedWords(words, threshold);
}
