import { z } from "zod";

/**
 * Configuration for streaming loop detection.
 *
 * When `enabled` is false, no loop detection occurs. When enabled, each
 * streamed delta is split once, as it arrives, into completed words per kind
 * (reasoning, message), and only the last `wordWindowSize` words are kept. A
 * loop is a word chain of `minChain`..`maxChain` words that recurs more than
 * `threshold` times anywhere in the window, so it is found across sentence and
 * paragraph boundaries, not just back-to-back at the tail. Words with no
 * letters or digits (`});`, `---`) never count. State is kept per stream (a
 * kind plus an id), at most `maxStreams` at once. The stream is then abandoned
 * and the TUI sends a silent "You're looping" nudge. If `escalationCount`
 * nudges occur within `escalationWindowMs`, the context is compacted instead of
 * nudging again.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent completed words compared for a recurring chain. Must
		// hold enough words for a chain to recur `threshold + 1` times across the
		// stream. The 190-word two-paragraph capture needs 570 at the default
		// threshold of 2 and 2090 at a threshold of 10, so the default is 2090.
		wordWindowSize: z.number().int().positive().default(2090),
		// Maximum number of streams (a kind plus an id) tracked at once. Two live at
		// the same moment is the realistic edge case; 4 leaves headroom. Streams that
		// are done are released, so a long turn with hundreds of sequential messages
		// never holds more than this. When more are live, the least recently updated
		// is evicted; a looping stream is always receiving deltas, so it is never the
		// one evicted. A stream with the window full holds about 30-40 KB (measured).
		maxStreams: z.number().int().positive().default(4),
		// Maximum worker threads in the loop-detection pool. Loop checks are small and
		// stateless, so a handful of threads is ample; capping this keeps the pool from
		// spawning one thread per CPU (which holds a large fixed RSS baseline).
		maxThreads: z.number().int().positive().default(4),
		// Accumulated stream text older than this many ms is dropped, so past
		// content cannot cause false positives as new content streams in.
		ttlMs: z.number().int().positive().default(60000),
		// A word chain must recur more than this many times to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Shortest word chain length to detect.
		minChain: z.number().int().positive().default(3),
		// Longest word chain length to detect.
		maxChain: z.number().int().positive().default(4),
		// Whether loop detection also applies to subagent reasoning streams.
		subagent: z.boolean().default(true),
		// Strike, within the escalation window, that compacts the context instead of
		// nudging: three strikes and you're out, so strikes 1 and 2 nudge and strike 3
		// compacts.
		escalationCount: z.number().int().positive().default(3),
		// Rolling window (ms) for counting loop strikes before escalation.
		escalationWindowMs: z.number().int().positive().default(60000),
	})
	.strict()
	.default({});
