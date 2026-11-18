import { Piscina } from "piscina";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { takeSentences, takeWords } from "./loopCheck.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Piscina | null} */
let pool = null;

/**
 * Piscina worker pool for loop detection. Created lazily on first use and then
 * reused, like the indexCode pool, so threads are not spawned per call and
 * nothing is spawned at import time.
 * @returns {Piscina} The shared pool
 */
export function getPool() {
	if (!pool) pool = new Piscina({ filename: join(__dirname, "loopDetectorWorker.js") });
	return pool;
}

/**
 * Destroy the shared pool (shutdown and tests). A later `getPool()` makes a new one.
 * @returns {Promise<void>}
 */
export async function destroyPool() {
	const current = pool;
	pool = null;
	await current?.destroy();
}

/**
 * Create a streaming loop detector.
 *
 * Each streamed delta is split once, as it arrives, into completed sentences
 * and words. State is kept per stream: the key is the kind (reasoning, message)
 * plus the stream's id, so concurrent streams never mix and detection is
 * restricted to the one stream a delta belongs to. A delta with no id (Chat
 * Completions `reasoning_content`) is keyed by kind alone. At most `maxStreams`
 * streams are tracked at once; the least recently updated is evicted. A looping
 * stream is by definition receiving deltas, so it is never the one evicted; the
 * cap only matters when more than `maxStreams` streams are live at the same
 * moment. Only the last `windowSize` sentences
 * and `wordWindowSize` words are kept, so memory and the cost of a check stay
 * bounded however long the stream runs, and the provider's delta boundaries do
 * not matter. A loop is a sentence repeated within the sentence window, or a
 * run of words repeated back-to-back (for loops with no sentence terminator,
 * such as "ok ok ok").
 *
 * The check runs in a worker thread so it never blocks the main loop. `push`
 * returns immediately with the latest known result. A check starts only when a
 * delta completed a new sentence or word, and at most one check per stream is in
 * flight.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=20] - Recent completed sentences kept and compared
 * @param {number} [options.wordWindowSize=1000] - Recent completed words kept and compared
 * @param {number} [options.threshold=2] - Repeats above which a loop is flagged
 * @param {number} [options.maxStreams=1000] - Streams tracked at once; the least recently updated is evicted
 * @param {number} [options.ttlMs] - State older than this is dropped (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @param {{ run: Function }} [options.runner] - Runs a check; defaults to the shared pool, injectable for tests
 * @returns {{ push: (kind: string, delta: string, id?: string | number) => boolean, settle: () => Promise<boolean>, reset: () => void }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 20;
	const wordWindowSize = options.wordWindowSize ?? 1000;
	const threshold = options.threshold ?? 2;
	const maxStreams = options.maxStreams ?? 1000;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());
	const runner = options.runner ?? { run: (task) => getPool().run(task) };

	/**
	 * @typedef {Object} KindState
	 * @property {string} pending - Unfinished sentence text
	 * @property {string} partialWord - Unfinished word
	 * @property {string[]} sentences - Last `windowSize` completed sentences
	 * @property {string[]} words - Last `wordWindowSize` completed words
	 * @property {number} ts - Time of the last delta
	 * @property {boolean} flagged - A check has flagged a loop
	 * @property {Promise<void> | null} inflight - The running check, if any
	 * @property {number} version - Bumped when a sentence or word completes
	 * @property {boolean} dead - The state was replaced, evicted or reset; in-flight answers are stale
	 */
	/** @type {Map<string, KindState>} Insertion order is recency order, oldest first. */
	const kinds = new Map();

	function freshState() {
		return {
			pending: "",
			partialWord: "",
			sentences: [],
			words: [],
			ts: now(),
			flagged: false,
			inflight: null,
			version: 0,
			dead: false,
		};
	}

	/**
	 * Get (or create) the state for a stream and mark it most recently used. The
	 * least recently used stream is evicted once more than `maxStreams` are tracked.
	 * @param {string} key - Stream key (kind, or kind plus id)
	 * @param {KindState} [replacement] - State to install in place of the existing one
	 * @returns {KindState} The stream's state
	 */
	function touch(key, replacement) {
		const existing = kinds.get(key);
		const state = replacement ?? existing ?? freshState();
		if (existing && existing !== state) existing.dead = true;
		kinds.delete(key);
		kinds.set(key, state);
		if (kinds.size > maxStreams) {
			const oldest = kinds.keys().next().value;
			kinds.get(oldest).dead = true;
			kinds.delete(oldest);
		}
		return state;
	}

	/**
	 * Keep only the last `size` entries, trimming in place.
	 * @param {string[]} list - List to trim
	 * @param {number} size - Entries to keep
	 * @returns {void}
	 */
	function trim(list, size) {
		if (list.length > size) list.splice(0, list.length - size);
	}

	/**
	 * Start a worker check on a kind's recent sentences and words, unless one is running.
	 * @param {KindState} state - Kind state
	 * @returns {void}
	 */
	function startCheck(state) {
		if (state.inflight) return;
		const checkedVersion = state.version;
		const task = { sentences: state.sentences.slice(), words: state.words.slice(), threshold };
		state.inflight = Promise.resolve(runner.run(task))
			.then((looping) => {
				// A state that was replaced, evicted or reset makes its answer stale.
				if (!state.dead && looping) state.flagged = true;
			})
			.catch(() => {
				// A failed check must never break streaming: treat as "not looping".
			})
			.finally(() => {
				state.inflight = null;
				// Sentences or words completed while checking: check again so the tail is covered.
				if (!state.dead && !state.flagged && state.version !== checkedVersion) {
					startCheck(state);
				}
			});
	}

	return {
		/**
		 * Record a streamed delta.
		 * @param {string} kind - Stream kind, e.g. "reasoning" or "message"
		 * @param {string} delta - The delta exactly as streamed
		 * @param {string | number} [id] - The stream's id; a delta with no id is keyed by kind alone
		 * @returns {boolean} True when a completed check has flagged a loop for this stream
		 */
		push(kind, delta, id) {
			if (typeof delta !== "string" || delta.length === 0) return false;
			const key = id == null ? kind : `${kind}\0${id}`;
			let state = touch(key);
			const nowMs = now();
			if (ttlMs !== undefined && nowMs - state.ts > ttlMs) {
				// Expired: start this stream over. touch() marks the old state dead, so
				// its in-flight answer is dropped without affecting any other stream.
				state = touch(key, freshState());
			}
			state.ts = nowMs;

			// Split only the new text. The unfinished tail is carried forward.
			const joined = state.pending + delta;
			const { sentences, rest } = takeSentences(joined, state.pending.length);
			state.pending = rest;
			const { words, rest: partialWord } = takeWords(state.partialWord, delta);
			state.partialWord = partialWord;

			if (sentences.length > 0) {
				state.sentences.push(...sentences);
				trim(state.sentences, windowSize);
			}
			if (words.length > 0) {
				state.words.push(...words);
				trim(state.words, wordWindowSize);
			}
			if (sentences.length > 0 || words.length > 0) {
				state.version++;
				if (!state.flagged) startCheck(state);
			}
			return state.flagged;
		},

		/**
		 * Wait for in-flight checks and report whether any kind is flagged.
		 * @returns {Promise<boolean>} True when a loop has been flagged
		 */
		async settle() {
			let pending = [...kinds.values()].map((s) => s.inflight).filter(Boolean);
			while (pending.length > 0) {
				await Promise.all(pending);
				pending = [...kinds.values()].map((s) => s.inflight).filter(Boolean);
			}
			return [...kinds.values()].some((s) => s.flagged);
		},

		/** Clear all state (call after a nudge so the next attempt starts fresh). */
		reset() {
			for (const state of kinds.values()) state.dead = true;
			kinds.clear();
		},
	};
}
