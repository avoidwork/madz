import { z } from "zod";

/**
 * Configuration for streaming loop detection.
 *
 * When `enabled` is false, no loop detection occurs. When enabled, every
 * streamed delta (a segment: a small group of characters as it arrives) is
 * hashed into a bounded per-kind list of `windowSize` hashes. A loop is flagged
 * when the tail of that list is one unit repeated back-to-back more than
 * `threshold` times. The stream is then abandoned and the turn re-run with a
 * "You're looping" nudge; after `streamMaxNudges` failed nudges the context is
 * compacted instead.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent segment (delta) hashes retained. Must hold
		// `threshold + 1` copies of the longest repeating unit; a paragraph is on
		// the order of 100 deltas.
		windowSize: z.number().int().positive().default(1000),
		// A unit must repeat back-to-back more than this many times to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Max times a single streamed turn is aborted and re-nudged before compacting instead.
		streamMaxNudges: z.number().int().nonnegative().default(2),
	})
	.strict()
	.default({});
