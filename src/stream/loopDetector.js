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
 * and words per kind (reasoning, message). Only the last `windowSize` sentences
 * and `wordWindowSize` words are kept, so memory and the cost of a check stay
 * bounded however long the stream runs, and the provider's delta boundaries do
 * not matter. A loop is a sentence repeated within the sentence window, or a
 * run of words repeated back-to-back (for loops with no sentence terminator,
 * such as "ok ok ok").
 *
 * The check runs in a worker thread so it never blocks the main loop. `push`
 * returns immediately with the latest known result. A check starts only when a
 * delta completed a new sentence or word, and at most one check per kind is in
 * flight.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=20] - Recent completed sentences kept and compared
 * @param {number} [options.wordWindowSize=1000] - Recent completed words kept and compared
 * @param {number} [options.threshold=2] - Repeats above which a loop is flagged
 * @param {number} [options.ttlMs] - State older than this is dropped (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @param {{ run: Function }} [options.runner] - Runs a check; defaults to the shared pool, injectable for tests
 * @returns {{ push: (kind: string, delta: string) => boolean, settle: () => Promise<boolean>, reset: () => void }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 20;
	const wordWindowSize = options.wordWindowSize ?? 1000;
	const threshold = options.threshold ?? 2;
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
	 */
	/** @type {Map<string, KindState>} */
	const kinds = new Map();
	let generation = 0;

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
		};
	}

	function getKind(kind) {
		let state = kinds.get(kind);
		if (!state) {
			state = freshState();
			kinds.set(kind, state);
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
		const forGeneration = generation;
		const checkedVersion = state.version;
		const task = { sentences: state.sentences.slice(), words: state.words.slice(), threshold };
		state.inflight = Promise.resolve(runner.run(task))
			.then((looping) => {
				// A reset since this check started makes its answer stale.
				if (forGeneration === generation && looping) state.flagged = true;
			})
			.catch(() => {
				// A failed check must never break streaming: treat as "not looping".
			})
			.finally(() => {
				state.inflight = null;
				// Sentences or words completed while checking: check again so the tail is covered.
				if (forGeneration === generation && !state.flagged && state.version !== checkedVersion) {
					startCheck(state);
				}
			});
	}

	return {
		/**
		 * Record a streamed delta.
		 * @param {string} kind - Stream kind, e.g. "reasoning" or "message"
		 * @param {string} delta - The delta exactly as streamed
		 * @returns {boolean} True when a completed check has flagged a loop
		 */
		push(kind, delta) {
			if (typeof delta !== "string" || delta.length === 0) return false;
			let state = getKind(kind);
			const nowMs = now();
			if (ttlMs !== undefined && nowMs - state.ts > ttlMs) {
				// Expired: start this kind over. Bumping the generation drops any stale in-flight answer.
				generation++;
				state = freshState();
				kinds.set(kind, state);
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
			generation++;
			kinds.clear();
		},
	};
}
