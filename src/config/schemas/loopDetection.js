import { z } from "zod";

/**
 * Configuration for streaming loop detection.
 *
 * When `enabled` is false, no loop detection occurs. When enabled, every
 * streamed delta (a segment: a small group of characters as it arrives) is
 * hashed into a bounded per-kind list of `windowSize` hashes. A loop is flagged
 * when the tail of that list is one unit repeated back-to-back more than
 * `threshold` times. The stream is then abandoned and the TUI sends a silent
 * "You're looping" nudge. If `escalationCount` nudges occur within
 * `escalationWindowMs`, the context is compacted instead of nudging again.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent segment (delta) hashes retained. Must hold
		// `threshold + 1` copies of the longest repeating unit; a paragraph is on
		// the order of 100 deltas.
		windowSize: z.number().int().positive().default(1000),
		// A hash older than this many ms is pruned from the window, so past
		// content cannot cause false positives as new content streams in.
		ttlMs: z.number().int().positive().default(60000),
		// A unit must repeat back-to-back more than this many times to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Number of loop nudges within the escalation window before compacting.
		escalationCount: z.number().int().positive().default(3),
		// Rolling window (ms) for counting loop nudges before escalation.
		escalationWindowMs: z.number().int().positive().default(60000),
	})
	.strict()
	.default({});
