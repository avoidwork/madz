import { z } from "zod";

/**
 * Configuration for context compaction.
 *
 * Compaction runs from the TUI: it fires automatically once the context
 * reaches `contextFraction` of the model's context window, and on `/compact`.
 * The reactive context-window handler remains the safety net.
 */
export const SummarizationSchema = z
	.object({
		// Number of most recent messages kept verbatim after compaction; everything
		// older is replaced by one summary message.
		keepMessages: z.number().int().min(0).optional(),
		// Fraction of the model's context window at which to auto-compact.
		contextFraction: z.number().positive().max(1).default(0.8),
	})
	.strict()
	.default({});
