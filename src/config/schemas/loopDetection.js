import { z } from "zod";

/**
 * Configuration for streaming loop detection.
 *
 * When `enabled` is false, no loop detection occurs. When enabled, each
 * streamed delta is split once, as it arrives, into completed sentences and
 * words per kind (reasoning, message), and only the last `windowSize` sentences
 * and `wordWindowSize` words are kept. A loop is a sentence repeated more than
 * `threshold` times within the sentence window, or a run of words repeated
 * back-to-back more than `threshold` times (loops with no punctuation). State
 * is kept per stream (a kind plus an id), at most `maxStreams` at once. The
 * stream is then abandoned and the TUI sends a silent "You're looping" nudge.
 * If `escalationCount` nudges occur within `escalationWindowMs`, the context is
 * compacted instead of nudging again.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent completed sentences compared for duplicates.
		windowSize: z.number().int().positive().default(20),
		// Number of recent completed words compared for a back-to-back repeat (loops
		// with no sentence terminator, such as "ok ok ok"). Must hold `threshold + 1`
		// copies of the longest repeating unit: the two-paragraph capture is 190
		// words, so 3 copies need 570.
		wordWindowSize: z.number().int().positive().default(1000),
		// Maximum number of streams (a kind plus an id) tracked at once. Two live at
		// the same moment is the realistic edge case; 4 leaves headroom. Streams that
		// are done are released, so a long turn with hundreds of sequential messages
		// never holds more than this. When more are live, the least recently updated
		// is evicted; a looping stream is always receiving deltas, so it is never the
		// one evicted. A stream with both windows full holds about 30-40 KB (measured).
		maxStreams: z.number().int().positive().default(4),
		// Accumulated stream text older than this many ms is dropped, so past
		// content cannot cause false positives as new content streams in.
		ttlMs: z.number().int().positive().default(60000),
		// A sentence (or word run) must repeat more than this many times to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Minimum sentence similarity for a garbled repeat to count as a loop.
		similarityThreshold: z.number().min(0).max(1).default(0.85),
		// Strike, within the escalation window, that compacts the context instead of
		// nudging: three strikes and you're out, so strikes 1 and 2 nudge and strike 3
		// compacts.
		escalationCount: z.number().int().positive().default(3),
		// Rolling window (ms) for counting loop strikes before escalation.
		escalationWindowMs: z.number().int().positive().default(60000),
	})
	.strict()
	.default({});
