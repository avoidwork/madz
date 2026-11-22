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
 * Normalize a sentence into a canonical token string: lowercase, strip
 * punctuation, and collapse whitespace. Used to compare sentences that are
 * garbled variants of the same content.
 * @param {string} sentence - The sentence to normalize
 * @returns {string} The normalized token string
 */
export function normalize(sentence) {
	return sentence
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Levenshtein edit distance between two strings.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} The edit distance
 */
function editDistance(a, b) {
	const m = a.length;
	const n = b.length;
	if (m === 0) return n;
	if (n === 0) return m;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const curr = [i];
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		prev = curr;
	}
	return prev[n];
}

/**
 * Character-level similarity between two single words, in [0,1]. Garbled
 * repetition corrupts characters within a word (e.g. "savs" for "says",
 * "BErURE" for "BEFORE"), so a character edit-distance similarity is used
 * rather than exact equality, which would treat a corrupted word as a
 * different token entirely.
 * @param {string} a - A word
 * @param {string} b - Another word
 * @returns {number} Similarity in [0,1]
 */
function wordSimilarity(a, b) {
	if (a.length === 0 || b.length === 0) return 0;
	const distance = editDistance(a, b);
	return 1 - distance / Math.max(a.length, b.length);
}

/**
 * A word is a garbled variant of another when their character similarity is at
 * least this value. Chosen so that a corrupted word (e.g. "savs" for "says",
 * "BErURE" for "BEFORE") counts as the same token while a genuinely different
 * word does not.
 */
const WORD_SIMILARITY_THRESHOLD = 0.6;

/**
 * Similarity between two normalized sentences, in [0,1]. The sentences are
 * compared as sequences of words using a Levenshtein edit distance over the
 * word sequence, where substituting one word for another costs 0 when the two
 * words are themselves character-similar (a garbled variant) and 1 otherwise.
 * This catches garbled repetition where the same content is re-emitted with
 * corrupted characters, while still treating genuinely different sentences as
 * dissimilar.
 * @param {string} a - A normalized sentence
 * @param {string} b - Another normalized sentence
 * @returns {number} Similarity in [0,1]
 */
export function similarity(a, b) {
	const tokensA = a.split(" ").filter(Boolean);
	const tokensB = b.split(" ").filter(Boolean);
	if (tokensA.length === 0 || tokensB.length === 0) return 0;
	const m = tokensA.length;
	const n = tokensB.length;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const curr = [i];
		for (let j = 1; j <= n; j++) {
			const sub =
				wordSimilarity(tokensA[i - 1], tokensB[j - 1]) >= WORD_SIMILARITY_THRESHOLD ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + sub);
		}
		prev = curr;
	}
	return 1 - prev[n] / Math.max(m, n);
}

/**
 * Look for a sentence that is similar (by normalized word-sequence similarity) to
 * another sentence appearing more than `threshold` times in `sentences`. This catches
 * garbled repetition where no two sentences are byte-identical.
 * @param {string[]} sentences - The recent completed sentences
 * @param {number} threshold - Occurrences above which a sentence is looping
 * @param {number} similarityThreshold - Minimum similarity to count as a repeat
 * @returns {boolean} True when a similar sentence repeats
 */
export function hasSimilarSentence(sentences, threshold, similarityThreshold) {
	const normalized = sentences.map(normalize);
	for (let i = 0; i < normalized.length; i++) {
		let count = 0;
		for (let j = 0; j < normalized.length; j++) {
			if (similarity(normalized[i], normalized[j]) >= similarityThreshold) count++;
		}
		if (count > threshold) return true;
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
 * @param {number} [task.similarityThreshold=0.85] - Minimum normalized token overlap to count a garbled repeat
 * @returns {boolean} True when the stream is looping
 */
export function checkLoop({ sentences, words, threshold, similarityThreshold = 0.85 }) {
	return (
		hasDuplicateSentence(sentences, threshold) ||
		hasRepeatedWords(words, threshold) ||
		hasSimilarSentence(sentences, threshold, similarityThreshold)
	);
}
