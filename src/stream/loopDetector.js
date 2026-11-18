import { Piscina } from "piscina";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
	if (current) await current.destroy();
}

/**
 * Create a streaming loop detector.
 *
 * Streamed deltas are accumulated into text per kind (reasoning, message). The
 * text, not the deltas, is checked, so it does not matter how the provider
 * chunks the stream. A loop is either a sentence that repeats within the last
 * `windowSize` completed sentences, or a run of words repeated back-to-back
 * (for loops with no sentence terminator, such as "ok ok ok").
 *
 * The check runs in a worker thread so it never blocks the main loop. `push`
 * returns immediately with the latest known result and starts a check in the
 * background when none is in flight, so a loop is reported on the first `push`
 * after its check completes. At most one check per kind is in flight.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=20] - Recent completed sentences compared
 * @param {number} [options.threshold=2] - Repeats above which a loop is flagged
 * @param {number} [options.ttlMs] - Accumulated text older than this is dropped (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @param {{ run: Function }} [options.runner] - Runs a check; defaults to the shared pool, injectable for tests
 * @returns {{ push: (kind: string, delta: string) => boolean, settle: () => Promise<boolean>, reset: () => void }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 20;
	const threshold = options.threshold ?? 2;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());
	const runner = options.runner ?? { run: (task) => getPool().run(task) };

	/** @type {Map<string, {text: string, ts: number, flagged: boolean, inflight: Promise<void> | null, version: number}>} */
	const kinds = new Map();
	let generation = 0;

	function getKind(kind) {
		let state = kinds.get(kind);
		if (!state) {
			state = { text: "", ts: now(), flagged: false, inflight: null, version: 0 };
			kinds.set(kind, state);
		}
		return state;
	}

	/**
	 * Start a worker check for a kind's current text, unless one is running.
	 * @param {{text: string, flagged: boolean, inflight: Promise<void> | null, version: number}} state - Kind state
	 * @returns {void}
	 */
	function startCheck(state) {
		if (state.inflight) return;
		const forGeneration = generation;
		const checkedVersion = state.version;
		state.inflight = Promise.resolve(runner.run({ text: state.text, windowSize, threshold }))
			.then((looping) => {
				// A reset since this check started makes its answer stale.
				if (forGeneration === generation && looping) state.flagged = true;
			})
			.catch(() => {
				// A failed check must never break streaming: treat as "not looping".
			})
			.finally(() => {
				state.inflight = null;
				// Text arrived while checking: check again so the tail is covered.
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
			const state = getKind(kind);
			const nowMs = now();
			if (ttlMs !== undefined && nowMs - state.ts > ttlMs) {
				state.text = "";
				state.flagged = false;
			}
			state.ts = nowMs;
			state.text += delta;
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

		/** Clear all state (call after a nudge so the next attempt starts fresh). */
		reset() {
			generation++;
			kinds.clear();
		},
	};
}
