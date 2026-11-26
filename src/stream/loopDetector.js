import { Piscina } from "piscina";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { takeWords } from "./loopCheck.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Piscina | null} */
let pool = null;

/**
 * Piscina worker pool for loop detection. Created lazily on first use and then
 * reused, like the indexCode pool, so threads are not spawned per call and
 * nothing is spawned at import time. The pool is capped at `maxThreads` so it
 * never spawns one thread per CPU; loop checks are small and stateless, so a
 * handful of threads is ample.
 * @param {number} [maxThreads=4] - Maximum worker threads in the pool
 * @returns {Piscina} The shared pool
 */
export function getPool(maxThreads = 4) {
	if (!pool) pool = new Piscina({ filename: join(__dirname, "loopDetectorWorker.js"), maxThreads });
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
 * Each streamed delta is split once, as it arrives, into completed words. State
 * is kept per stream: the key is the kind (reasoning, message) plus the stream's
 * id, so concurrent streams never mix and detection is restricted to the one
 * stream a delta belongs to. A delta with no id (Chat Completions
 * `reasoning_content`) is keyed by kind alone. At most `maxStreams` streams are
 * tracked at once; the least recently updated is evicted. A looping stream is by
 * definition receiving deltas, so it is never the one evicted; the cap only
 * matters when more than `maxStreams` streams are live at the same moment. Only
 * the last `wordWindowSize` words are kept, so memory and the cost of a check
 * stay bounded however long the stream runs, and the provider's delta boundaries
 * do not matter. A loop is a word chain of `minChain`..`maxChain` words that
 * recurs more than `threshold` times anywhere in the window, so it is found
 * across sentence and paragraph boundaries, not just back-to-back at the tail.
 *
 * The check runs in a worker thread so it never blocks the main loop. `push`
 * returns immediately with the latest known result. A check starts only when a
 * delta completed a new word, and at most one check per stream is in flight.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.wordWindowSize=2090] - Recent completed words kept and compared
 * @param {number} [options.threshold=3] - Occurrences above which a loop is flagged
 * @param {number} [options.minChain=5] - Shortest recurring chain length to detect
 * @param {number} [options.maxChain=8] - Longest recurring chain length to detect
 * @param {number} [options.maxRun=50] - Longest repeated run unit, in words, to detect
 * @param {number} [options.maxStreams=4] - Streams tracked at once; the least recently updated is evicted
 * @param {number} [options.maxThreads=4] - Maximum worker threads in the shared pool
 * @param {number} [options.toolCallThreshold=3] - Consecutive identical tool calls above which a loop is flagged
 * @param {number} [options.ttlMs] - State older than this is dropped (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @param {{ run: Function }} [options.runner] - Runs a check; defaults to the shared pool, injectable for tests
 * @returns {{ push: (kind: string, delta: string, id?: string | number) => boolean, pushTool: (name: string, target: string, id?: string | number) => boolean, settle: () => Promise<boolean>, end: () => Promise<boolean>, reset: () => void, release: (kind: string, id?: string | number) => void, size: () => number }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const threshold = options.threshold ?? 3;
	const minChain = options.minChain ?? 5;
	const maxChain = options.maxChain ?? 8;
	const maxRun = options.maxRun ?? 50;
	const toolCallThreshold = options.toolCallThreshold ?? 3;
	const wordWindowSize = options.wordWindowSize ?? 2090;
	const maxStreams = options.maxStreams ?? 4;
	const maxThreads = options.maxThreads ?? 4;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());
	const runner = options.runner ?? { run: (task) => getPool(maxThreads).run(task) };

	/**
	 * @typedef {Object} KindState
	 * @property {string} partialWord - Unfinished word
	 * @property {string[] | null} words - Last `wordWindowSize` completed words (null once released)
	 * @property {Array<{name: string, target: string}> | null} toolCalls - Recent tool-call records (null once released)
	 * @property {number} ts - Time of the last delta
	 * @property {boolean} flagged - A check has flagged a loop
	 * @property {Promise<void> | null} inflight - The running check, if any
	 * @property {number} version - Bumped when a word completes
	 * @property {boolean} dead - The state was replaced, evicted or reset; in-flight answers are stale
	 */
	/** @type {Map<string, KindState>} Insertion order is recency order, oldest first. */
	const kinds = new Map();

	function freshState() {
		return {
			partialWord: "",
			words: [],
			toolCalls: [],
			ts: now(),
			flagged: false,
			inflight: null,
			version: 0,
			dead: false,
		};
	}

	/**
	 * Release a stream's state: clear its word list and null it so the memory is
	 * freed even while a closure (an in-flight check) still holds the state
	 * object. A released state is dead, so any in-flight answer is ignored.
	 * @param {KindState} state - State to release
	 * @returns {void}
	 */
	function release(state) {
		state.dead = true;
		state.partialWord = "";
		if (state.words) state.words.length = 0;
		state.words = null;
		if (state.toolCalls) state.toolCalls.length = 0;
		state.toolCalls = null;
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
		if (existing && existing !== state) release(existing);
		kinds.delete(key);
		kinds.set(key, state);
		if (kinds.size > maxStreams) {
			const oldest = kinds.keys().next().value;
			release(kinds.get(oldest));
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
	 * Start a worker check on a kind's recent words, unless one is running.
	 * @param {KindState} state - Kind state
	 * @returns {void}
	 */
	function startCheck(state) {
		if (state.inflight) return;
		const checkedVersion = state.version;
		const task = {
			words: state.words.slice(),
			threshold,
			minChain,
			maxChain,
			maxRun,
			toolCalls: state.toolCalls?.slice() ?? [],
			toolCallThreshold,
		};
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
				// Words completed while checking: check again so the tail is covered.
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

			const { words, rest: partialWord } = takeWords(state.partialWord, delta);
			state.partialWord = partialWord;

			if (words.length > 0) {
				state.words.push(...words);
				trim(state.words, wordWindowSize);
			}
			if (words.length > 0) {
				state.version++;
				if (!state.flagged) startCheck(state);
			}
			return state.flagged;
		},

		/**
		 * Record a tool call against a target. Tool-call metadata is a distinct
		 * signal from streamed text: a loop is flagged when the same tool name +
		 * same target recurs with no state change between calls. The metadata is
		 * validated as untrusted input before it is recorded.
		 * @param {string} name - The tool name
		 * @param {string} target - The tool's target/argument
		 * @param {string | number} [id] - The stream's id; a call with no id is keyed by kind alone
		 * @returns {boolean} True when a completed check has flagged a loop for this stream
		 */
		pushTool(name, target, id) {
			if (typeof name !== "string" || name.length === 0) return false;
			if (typeof target !== "string" || target.length === 0) return false;
			const key = id == null ? "tools" : `tools\0${id}`;
			let state = touch(key);
			const nowMs = now();
			if (ttlMs !== undefined && nowMs - state.ts > ttlMs) {
				state = touch(key, freshState());
			}
			state.ts = nowMs;
			state.toolCalls.push({ name, target });
			state.version++;
			if (!state.flagged) startCheck(state);
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

		/** Release every stream's state (called when a message turn ends, and after a nudge). */
		reset() {
			for (const state of kinds.values()) release(state);
			kinds.clear();
		},

		/**
		 * Release a single stream's state (called when a subagent's reasoning turn
		 * ends), so its list is freed without disturbing any other stream.
		 * @param {string} kind - Stream kind, e.g. "reasoning" or "message"
		 * @param {string | number} [id] - The stream's id; a stream with no id is keyed by kind alone
		 * @returns {void}
		 */
		release(kind, id) {
			const key = id == null ? kind : `${kind}\0${id}`;
			const state = kinds.get(key);
			if (state) {
				release(state);
				kinds.delete(key);
			}
		},

		/**
		 * End a message turn: collect the verdict of any check still running (the
		 * last deltas may have started one), then release every stream's list. The
		 * verdict is read before the release, so a loop in the final deltas of the
		 * message is not lost.
		 * @returns {Promise<boolean>} True when a loop was flagged during the message
		 */
		async end() {
			const flagged = await this.settle();
			this.reset();
			return flagged;
		},

		/**
		 * Number of streams currently tracked.
		 * @returns {number} Tracked stream count
		 */
		size() {
			return kinds.size;
		},
	};
}
