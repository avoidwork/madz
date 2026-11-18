import { createHash } from "node:crypto";

/**
 * Create a streaming loop detector that hashes stream segments.
 *
 * A segment is one streamed delta: a small group of characters exactly as it
 * arrives (not a sentence or paragraph). Each delta is hashed and appended to
 * a bounded list, per stream kind (reasoning, message). A looping model
 * re-emits the same sequence of segments, so a loop is a trailing run of the
 * hash list that repeats back-to-back more than `threshold` times, whatever
 * the length of the repeating unit (a word, a sentence, a paragraph).
 *
 * `windowSize` must be large enough to hold `threshold + 1` copies of the
 * longest unit to be caught: a paragraph is on the order of 100 deltas.
 * Hashes older than `ttlMs` are pruned so past content cannot form a false
 * positive with new content.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=1000] - Segment hashes retained per kind
 * @param {number} [options.threshold=2] - Back-to-back repeats above which a loop is flagged
 * @param {number} [options.ttlMs] - Hashes older than this are pruned (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @returns {{ push: (kind: string, delta: string) => boolean, reset: () => void }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 1000;
	const threshold = options.threshold ?? 2;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());
	const needed = threshold + 1;

	/** @type {Map<string, {hash: string, ts: number}[]>} */
	const lists = new Map();

	/**
	 * Check whether the tail of the list is one unit repeated `needed` times.
	 * @param {{hash: string, ts: number}[]} list - Segment hashes, oldest first
	 * @returns {boolean} True when a repeating unit is found
	 */
	function isLooping(list) {
		const n = list.length;
		const last = list[n - 1].hash;
		for (let period = 1; period * needed <= n; period++) {
			// Cheap reject: the unit's last segment must recur exactly one period back.
			if (list[n - 1 - period].hash !== last) continue;
			let match = true;
			for (let i = 1; i < period * (needed - 1) && match; i++) {
				if (list[n - 1 - i].hash !== list[n - 1 - i - period].hash) match = false;
			}
			if (match) return true;
		}
		return false;
	}

	return {
		/**
		 * Record a streamed segment.
		 * @param {string} kind - Stream kind, e.g. "reasoning" or "message"
		 * @param {string} delta - The segment exactly as streamed
		 * @returns {boolean} True when the stream is looping
		 */
		push(kind, delta) {
			if (typeof delta !== "string" || delta.length === 0) return false;
			let list = lists.get(kind);
			if (!list) {
				list = [];
				lists.set(kind, list);
			}
			const nowMs = now();
			if (ttlMs !== undefined) {
				while (list.length > 0 && nowMs - list[0].ts > ttlMs) list.shift();
			}
			list.push({ hash: createHash("sha256").update(delta).digest("hex"), ts: nowMs });
			while (list.length > windowSize) list.shift();
			return isLooping(list);
		},

		/** Clear all state (call after a nudge so the next attempt starts fresh). */
		reset() {
			lists.clear();
		},
	};
}
