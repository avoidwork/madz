import { z } from "zod";

/**
 * Configuration for the `LoopDetection` middleware.
 *
 * When `enabled` is false (or the section is absent), madz does not register
 * the loop-detection middleware and no loop detection occurs. When enabled,
 * the middleware hashes the most recent model message text and reasoning
 * content independently per thread, and injects a "You're looping" nudge when
 * a hash repeats more than `threshold` times within a rolling `windowSize`
 * window. If `escalationCount` nudges occur within `escalationWindowMs`, the
 * middleware invokes the agent's compaction path instead of nudging again.
 */
export const LoopDetectionSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Number of recent content hashes retained per thread for loop detection.
		windowSize: z.number().int().positive().default(10),
		// A hash must appear more than this many times within the window to flag a loop.
		threshold: z.number().int().positive().default(2),
		// Number of loop nudges within the escalation window before compacting.
		escalationCount: z.number().int().positive().default(3),
		// Rolling window (ms) for counting loop nudges before escalation.
		escalationWindowMs: z.number().int().positive().default(60000),
	})
	.strict()
	.default({});
