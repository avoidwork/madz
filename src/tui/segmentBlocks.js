/**
 * Segment block coalescing logic for streaming TUI messages.
 *
 * Reasoning and message segments arrive as a stream. We want to render them as
 * blocks so that a continuous reasoning stream stays one block and message text
 * reads as continuous, while a genuine type transition (message↔reasoning) can
 * still start a new block.
 *
 * The model is treated like an upsert: each incoming segment of a type appends
 * to the last block of that type, unless a new block should be created.
 *
 * @module segmentBlocks
 */

/**
 * Create a fresh block tracker. Each type (message, reasoning) keeps a ref to
 * its last block's content and arrival time. The most recent segment overall is
 * tracked so a type transition can be detected.
 * @returns {{blocks: {message: null, reasoning: null}, last: null}}
 */
export function createBlockTracker() {
	return {
		blocks: { message: null, reasoning: null },
		last: null, // { type, content, time }
	};
}

/**
 * Decide whether an incoming segment of a given type should start a new block
 * or append to the last block of that type.
 *
 * - First segment of a type → new block.
 * - Same type as the previous segment → always append (a continuous reasoning
 *   stream stays one block regardless of pauses).
 * - Type transition (message↔reasoning) → split only if the last block of the
 *   incoming type ended with a sentence boundary (.!?).
 *
 * @param {Object} tracker - Block tracker from {@link createBlockTracker}
 * @param {string} type - Segment type ("message" | "reasoning")
 * @returns {boolean} True if a new block should be created
 */
export function shouldStartNewBlock(tracker, type) {
	const last = tracker.blocks[type];
	if (!last) return true; // first segment of this type
	const prev = tracker.last;
	if (prev && prev.type !== type) {
		// Type transition — split only if the previous block of this type ended
		// with a sentence boundary.
		return /[.?!]$/.test(last.content);
	}
	return false; // same type — always append
}

/**
 * Upsert a segment into the tracker: append to the last block of its type, or
 * create a new block when {@link shouldStartNewBlock} says so. Tracks the last
 * segment overall so type transitions are detected.
 *
 * @param {Object} tracker - Block tracker from {@link createBlockTracker}
 * @param {string} type - Segment type ("message" | "reasoning")
 * @param {string} content - Segment content
 * @param {number} time - Arrival timestamp (ms)
 * @returns {boolean} True if a new block was created
 */
export function upsertSegment(tracker, type, content, time) {
	const newBlock = shouldStartNewBlock(tracker, type);
	const last = tracker.blocks[type];
	if (!newBlock && last) {
		last.content += content;
		last.time = time;
	} else {
		tracker.blocks[type] = { content, time };
	}
	tracker.last = { type, content, time };
	return newBlock;
}
