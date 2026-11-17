import { z } from "zod";

/**
 * Configuration for streaming loop detection.
 *
 * When `enabled` is false, no loop detection occurs. When enabled, streamed
 * reasoning and message text are split into segments (sentences/lines), each
 * segment is hashed into a rolling `windowSize` window, and a loop is flagged
 * when a segment hash repeats more than `threshold` times. The stream is then
 * abandoned and the turn re-run with a "You're looping" nudge; after
 * `streamMaxNudges` failed nudges the context is compacted instead.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent segment (sentence) hashes retained for loop detection.
		windowSize: z.number().int().positive().default(50),
		// A hash older than this many ms is pruned from the window.
		ttlMs: z.number().int().positive().default(60000),
		// A segment hash must appear more than this many times within the window to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Max times a single streamed turn is aborted and re-nudged before compacting instead.
		streamMaxNudges: z.number().int().nonnegative().default(2),
	})
	.strict()
	.default({});
