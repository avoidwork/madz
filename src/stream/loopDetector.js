import { createHash } from "node:crypto";

const BOUNDARY = /(?<=[.!?])\s+|\n+/;

/**
 * Create a segment-hash repetition detector.
 *
 * Text (reasoning and message text, tracked separately by `kind`) is buffered
 * and split into sentences/lines. Each completed segment is normalized and
 * hashed into a rolling window; when one hash occurs more than `threshold`
 * times the detector reports a loop. It is used both on live stream deltas
 * (catching repetition within a single generation) and on completed assistant
 * messages (catching repetition across turns), so one mechanism serves both.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=50] - Segment hashes retained per kind
 * @param {number} [options.threshold=2] - Occurrences above which a loop is flagged
 * @param {number} [options.minLength=24] - Segments shorter than this are ignored
 * @param {number} [options.maxBuffer=500] - Force a split when no boundary appears
 * @param {number} [options.ttlMs] - Hashes older than this are pruned (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @returns {{ push: (kind: string, delta: string) => boolean, flush: (kind?: string) => boolean, reset: () => void }} Detector
 */
export function createStreamLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 50;
	const threshold = options.threshold ?? 2;
	const minLength = options.minLength ?? 24;
	const maxBuffer = options.maxBuffer ?? 500;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());

	/** @type {Map<string, {buffer: string, hashes: {hash: string, ts: number}[]}>} */
	const kinds = new Map();

	function getKind(kind) {
		let state = kinds.get(kind);
		if (!state) {
			state = { buffer: "", hashes: [] };
			kinds.set(kind, state);
		}
		return state;
	}

	function record(state, segment) {
		const normalized = segment.replace(/\s+/g, " ").trim().toLowerCase();
		if (normalized.length < minLength) return false;
		const nowMs = now();
		if (ttlMs !== undefined) {
			while (state.hashes.length > 0 && nowMs - state.hashes[0].ts > ttlMs) state.hashes.shift();
		}
		const hash = createHash("sha256").update(normalized).digest("hex");
		state.hashes.push({ hash, ts: nowMs });
		while (state.hashes.length > windowSize) state.hashes.shift();
		let count = 0;
		for (const entry of state.hashes) if (entry.hash === hash) count++;
		return count > threshold;
	}

	return {
		/**
		 * Feed a delta (or a whole message).
		 * @param {string} kind - Kind, e.g. "reasoning" or "message"
		 * @param {string} delta - New text
		 * @returns {boolean} True when a loop has been detected
		 */
		push(kind, delta) {
			if (typeof delta !== "string" || delta.length === 0) return false;
			const state = getKind(kind);
			state.buffer += delta;

			const parts = state.buffer.split(BOUNDARY);
			state.buffer = parts.pop() ?? "";
			if (state.buffer.length > maxBuffer) {
				parts.push(state.buffer);
				state.buffer = "";
			}

			let looped = false;
			for (const part of parts) if (record(state, part)) looped = true;
			return looped;
		},

		/**
		 * Hash any buffered trailing text as a final segment. Call at the end of a
		 * complete message so its last (unterminated) segment is counted.
		 * @param {string} [kind] - Kind to flush; all kinds when omitted
		 * @returns {boolean} True when the flushed segment completes a loop
		 */
		flush(kind) {
			let looped = false;
			const targets = kind === undefined ? [...kinds.values()] : [getKind(kind)];
			for (const state of targets) {
				const rest = state.buffer;
				state.buffer = "";
				if (rest && record(state, rest)) looped = true;
			}
			return looped;
		},

		/** Clear all state (call after a nudge so the next attempt starts fresh). */
		reset() {
			kinds.clear();
		},
	};
}
