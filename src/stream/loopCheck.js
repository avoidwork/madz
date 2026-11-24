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

/** Longest sentence loop (in sentences) the detector is asked to catch. */
export const DEFAULT_MAX_LOOP_SENTENCES = 5;

/**
 * Drop lines that carry no letters or digits (`});`, `| --- | --- |`, `---`). They
 * are structure, not content, so a run of them is never a loop.
 * @param {string[]} sentences - Completed sentences
 * @returns {string[]} The sentences that have comparable content
 */
function meaningful(sentences) {
	return sentences.filter((sentence) => normalize(sentence) !== "");
}

/**
 * Look for a sentence that occurs more than `threshold` times in `sentences`.
 * Lines with no letters or digits are ignored.
 * @param {string[]} sentences - The recent completed sentences
 * @param {number} threshold - Occurrences above which a sentence is looping
 * @returns {boolean} True when a sentence repeats
 */
export function hasDuplicateSentence(sentences, threshold) {
	const counts = new Map();
	for (const sentence of meaningful(sentences)) {
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
 * Precompute what a repeat comparison needs from one sentence.
 * - `digits`: its numeric tokens. Two sentences with different numbers are never
 *   repeats ("Step 3 done" / "Step 4 done", file1.js / file2.js), so numbers are
 *   compared strictly instead of being fuzzed away.
 * - `fuzzy`: whether it may match a merely similar sentence. Garbling corrupts
 *   characters inside prose words, so fuzzy matching needs at least two prose
 *   words (a whitespace token that is one plain word). Paths, identifiers and
 *   bullets of them ("src/a/fileA.js") are not prose: they match only exactly.
 * @param {string} sentence - A completed sentence
 * @returns {{ norm: string, tokens: number, digits: string, fuzzy: boolean }} Comparison data
 */
function prepare(sentence) {
	const norm = normalize(sentence);
	const proseWords = sentence.split(/\s+/).filter((token) => {
		const n = normalize(token);
		return n !== "" && !n.includes(" ");
	}).length;
	return {
		norm,
		tokens: norm.split(" ").length,
		digits: (norm.match(/\p{N}+/gu) ?? []).join(","),
		fuzzy: proseWords >= 2,
	};
}

/**
 * Whether two prepared sentences are the same sentence for loop purposes: the same
 * numbers, and either the same normalized text or (for prose) a similarity at or
 * above `similarityThreshold`.
 * @param {ReturnType<typeof prepare>} a - A prepared sentence
 * @param {ReturnType<typeof prepare>} b - Another prepared sentence
 * @param {number} similarityThreshold - Minimum similarity to count as a repeat
 * @returns {boolean} True when the sentences repeat each other
 */
function isRepeat(a, b, similarityThreshold) {
	if (a.digits !== b.digits) return false;
	if (a.norm === b.norm) return true;
	if (!a.fuzzy || !b.fuzzy) return false;
	// Similarity cannot exceed the token-count ratio, so skip the edit distance when it must fail.
	if (Math.min(a.tokens, b.tokens) / Math.max(a.tokens, b.tokens) < similarityThreshold) {
		return false;
	}
	return similarity(a.norm, b.norm) >= similarityThreshold;
}

/**
 * Look for a sentence that is similar (by normalized word-sequence similarity) to
 * another sentence appearing more than `threshold` times in `sentences`. This catches
 * garbled repetition where no two sentences are byte-identical. Lines with no letters
 * or digits are ignored, and sentences that differ in their numbers are not repeats.
 * @param {string[]} sentences - The recent completed sentences
 * @param {number} threshold - Occurrences above which a sentence is looping
 * @param {number} similarityThreshold - Minimum similarity to count as a repeat
 * @returns {boolean} True when a similar sentence repeats
 */
export function hasSimilarSentence(sentences, threshold, similarityThreshold) {
	const prepared = meaningful(sentences).map(prepare);
	const counts = prepared.map(() => 1);
	for (let i = 0; i < prepared.length; i++) {
		for (let j = i + 1; j < prepared.length; j++) {
			if (!isRepeat(prepared[i], prepared[j], similarityThreshold)) continue;
			counts[i]++;
			counts[j]++;
		}
		if (counts[i] > threshold) return true;
	}
	return false;
}

/**
 * Look for a run of 1..`maxPeriod` sentences repeated back-to-back at the end of
 * `sentences`, more than `threshold` times (the sentence counterpart of
 * `hasRepeatedWords`). Copies match when they are the same sentence or a garbled
 * variant (see `isRepeat`). Lines with no letters or digits are ignored. The cost is
 * at most `maxPeriod * threshold` comparisons, so it is bounded by the window.
 * @param {string[]} sentences - The recent completed sentences
 * @param {number} threshold - Back-to-back repeats above which a loop is flagged
 * @param {number} similarityThreshold - Minimum similarity to count as a repeat
 * @param {number} [maxPeriod=DEFAULT_MAX_LOOP_SENTENCES] - Longest loop, in sentences
 * @returns {boolean} True when the tail is one sentence run repeated more than `threshold` times
 */
export function hasRepeatedSentences(
	sentences,
	threshold,
	similarityThreshold,
	maxPeriod = DEFAULT_MAX_LOOP_SENTENCES,
) {
	const prepared = meaningful(sentences).map(prepare);
	const n = prepared.length;
	for (let period = 1; period <= maxPeriod && period * (threshold + 1) <= n; period++) {
		let match = true;
		for (let i = 0; i < period * threshold && match; i++) {
			match = isRepeat(prepared[n - 1 - i], prepared[n - 1 - i - period], similarityThreshold);
		}
		if (match) return true;
	}
	return false;
}

/**
 * Look for a run of words repeated back-to-back at the end of `words`. This
 * covers loops with no sentence terminator at all, such as "ok ok ok ok". Words with
 * no letters or digits (`});`, `|`, `---`) are skipped, as they are in the sentence checks.
 * @param {string[]} allWords - The recent completed words
 * @param {number} threshold - Back-to-back repeats above which a loop is flagged
 * @returns {boolean} True when the tail is one word run repeated more than `threshold` times
 */
export function hasRepeatedWords(allWords, threshold) {
	const words = allWords.filter((word) => normalize(word) !== "");
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
 * @param {number} [task.similarityThreshold=0.85] - Minimum sentence similarity to count a garbled repeat
 * @param {number} [task.maxLoopSentences=5] - Longest sentence loop to detect, in sentences
 * @returns {boolean} True when the stream is looping
 */
export function checkLoop({
	sentences,
	words,
	threshold,
	similarityThreshold = 0.85,
	maxLoopSentences = DEFAULT_MAX_LOOP_SENTENCES,
}) {
	return (
		hasDuplicateSentence(sentences, threshold) ||
		hasRepeatedSentences(sentences, threshold, similarityThreshold, maxLoopSentences) ||
		hasRepeatedWords(words, threshold) ||
		hasSimilarSentence(sentences, threshold, similarityThreshold)
	);
}
