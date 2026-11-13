import { z } from "zod";

/**
 * A summarization threshold: a trigger/keep policy expressed as a count of
 * messages, a token count, or a fraction of the model's max input tokens.
 * The `value` must be a positive number (fraction) or positive integer
 * (messages/tokens).
 */
const SummarizationThresholdSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("tokens"),
		value: z.number().int().positive(),
	}),
	z.object({
		type: z.literal("messages"),
		value: z.number().int().positive(),
	}),
	z.object({
		type: z.literal("fraction"),
		value: z.number().positive().max(1),
	}),
]);

/**
 * Configuration for the deepagents `SummarizationMiddleware`.
 *
 * When `enabled` is false (or the section is absent), madz does not register a
 * custom summarization middleware and deepagents' library default applies
 * (170k token trigger / keep last 6 messages). When enabled, the configured
 * `trigger` and `keep` thresholds are passed to `createSummarizationMiddleware`
 * so compaction is proactive rather than reactive.
 */
export const SummarizationSchema = z
	.object({
		enabled: z.boolean().default(false),
		trigger: SummarizationThresholdSchema.optional(),
		// Deprecated: use `keepMessages`. A `messages` keep value is still honored.
		keep: SummarizationThresholdSchema.optional(),
		// Number of most recent messages kept verbatim after compaction; everything
		// older is replaced by one summary message.
		keepMessages: z.number().int().min(0).optional(),
		// Fraction of the model's context window at which to compact. Used to
		// derive a `tokens` trigger when the context length can be resolved.
		contextFraction: z.number().positive().max(1).default(0.8),
	})
	.strict()
	.default({});
