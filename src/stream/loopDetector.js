import { createHash } from "node:crypto";
import { coalesceSegments } from "../tui/messages.js";

/**
 * Create a streaming loop detector that hashes stream segments.
 *
 * Stream events are folded into segments with the same `coalesceSegments`
 * routine the TUI uses (see docs/STREAMING.md), so a segment here is exactly
 * a `message` or `reasoning` block as the app defines it: chunks sharing an
 * `id` merge into one block, and id-less reasoning splits on a grammatical
 * sentence boundary. When a new segment starts, the previous one is complete;
 * its content is hashed into a rolling window. A loop is flagged when the same
 * segment (same type and content) completes more than `threshold` times.
 *
 * Tool segments are not hashed. A segment is never counted until it closes, so
 * a single unbroken block cannot be flagged by this detector.
 *
 * @param {Object} [options] - Options
 * @param {number} [options.windowSize=50] - Segment hashes retained
 * @param {number} [options.threshold=2] - Completions above which a loop is flagged
 * @param {number} [options.ttlMs] - Hashes older than this are pruned (no expiry when unset)
 * @param {Function} [options.now] - Clock returning ms (injectable for tests)
 * @returns {{ push: (segment: {type: string, content: string, id?: string | number}) => boolean, reset: () => void }} Detector
 */
export function createSegmentLoopDetector(options = {}) {
	const windowSize = options.windowSize ?? 50;
	const threshold = options.threshold ?? 2;
	const ttlMs = options.ttlMs;
	const now = options.now ?? (() => Date.now());

	let segments = [];
	/** @type {{hash: string, ts: number}[]} */
	let hashes = [];

	/**
	 * Hash a completed segment into the window and report whether it repeats
	 * more than `threshold` times.
	 * @param {{type: string, content: string}} segment - The completed segment
	 * @returns {boolean} True when the segment is looping
	 */
	function record(segment) {
		if (segment.type !== "message" && segment.type !== "reasoning") return false;
		const content = segment.content.trim();
		if (content.length === 0) return false;

		const nowMs = now();
		if (ttlMs !== undefined) {
			while (hashes.length > 0 && nowMs - hashes[0].ts > ttlMs) hashes.shift();
		}
		const hash = createHash("sha256").update(`${segment.type}\0${content}`).digest("hex");
		hashes.push({ hash, ts: nowMs });
		while (hashes.length > windowSize) hashes.shift();

		let count = 0;
		for (const entry of hashes) if (entry.hash === hash) count++;
		return count > threshold;
	}

	return {
		/**
		 * Fold a stream event's segment in. If it starts a new segment, the
		 * previous one is complete and is hashed.
		 * @param {{type: string, content: string, id?: string | number}} segment - Incoming segment
		 * @returns {boolean} True when a completed segment is looping
		 */
		push(segment) {
			const before = segments.length;
			segments = coalesceSegments(segments, segment);
			if (before > 0 && segments.length > before) return record(segments[before - 1]);
			return false;
		},

		/** Clear all state (call after a nudge so the next attempt starts fresh). */
		reset() {
			segments = [];
			hashes = [];
		},
	};
}
