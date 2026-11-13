import { createMiddleware, countTokensApproximately } from "langchain";
import { RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { compactMessages, DEFAULT_KEEP_MESSAGES } from "../agent/compaction.js";
import { logger } from "../shared/logger.js";

/** After a failed compaction, wait for this many new messages before retrying. */
const RETRY_AFTER_MESSAGES = 4;

/**
 * Resolve how many recent messages to keep verbatim.
 * Precedence: `keepMessages`, then a legacy `keep: { type: "messages" }`, then 5.
 * @param {Object} config - The resolved `summarization` config section
 * @returns {number} Number of messages to keep
 */
export function resolveKeepMessages(config = {}) {
	if (Number.isInteger(config.keepMessages) && config.keepMessages >= 0) {
		return config.keepMessages;
	}
	if (config.keep?.type === "messages" && Number.isInteger(config.keep.value)) {
		return config.keep.value;
	}
	return DEFAULT_KEEP_MESSAGES;
}

/**
 * Build the compaction middleware from madz config.
 *
 * When the conversation reaches the configured trigger, the history is
 * summarized and the **checkpointer state is rewritten** to
 * `[summary, ...last N messages]` (the system prompt is injected on every call
 * and is not part of state). This replaces the library middleware, which only
 * hides old messages behind a `_summarizationEvent` and leaves the stored
 * history growing. The middleware is named `SummarizationMiddleware`, so
 * `mergeMiddlewareStack` in `createDeepAgent` displaces the library default.
 *
 * Returns `null` when disabled or when no trigger is available, so the library
 * default applies.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.backend - deepagents backend used for history offload
 * @param {Object} options.model - Chat model used to write the summary
 * @param {Object} [options.config] - The resolved `summarization` config section
 * @param {string} [options.systemPrompt] - System prompt, counted toward usage
 * @param {Function} [options.tokenCounter] - async (messages) => token count
 * @param {Function} [options.onCompacted] - Called with the compaction result
 * @returns {Object|null} The middleware, or `null` when disabled
 */
export function createSummarizationMiddlewareFromConfig(options = {}) {
	const { backend, model, config = {}, systemPrompt, tokenCounter, onCompacted } = options;
	if (config.enabled !== true) return null;

	const trigger = config.trigger;
	if (!trigger) {
		logger.warn(
			{ trigger },
			"[summarization] enabled but missing trigger; falling back to library defaults",
		);
		return null;
	}
	const keep = resolveKeepMessages(config);
	logger.info({ trigger, keep }, "[summarization] registering compaction middleware");

	let failedAtLength = -1;

	/**
	 * Count tokens for the messages the model would receive.
	 * @param {Array} messages - State messages
	 * @returns {Promise<number>} Token count
	 */
	const count = async (messages) => {
		const counted = systemPrompt ? [new SystemMessage(systemPrompt), ...messages] : messages;
		if (typeof tokenCounter === "function") {
			try {
				return await tokenCounter(counted);
			} catch (err) {
				logger.warn(
					{ error: err?.message },
					"[summarization] token counter failed; using estimate",
				);
			}
		}
		return countTokensApproximately(counted);
	};

	/**
	 * Decide whether the trigger has fired.
	 * @param {Array} messages - State messages
	 * @returns {Promise<{over: boolean, tokens: (number|undefined)}>} Decision
	 */
	const check = async (messages) => {
		if (trigger.type === "messages") {
			return { over: messages.length >= trigger.value, tokens: undefined };
		}
		if (trigger.type === "tokens") {
			const tokens = await count(messages);
			return { over: tokens >= trigger.value, tokens };
		}
		return { over: false, tokens: undefined };
	};

	return createMiddleware({
		name: "SummarizationMiddleware",
		beforeModel: {
			canJumpTo: [],
			hook: async (state, runtime) => {
				const messages = state?.messages ?? [];
				if (messages.length === 0) return undefined;
				if (failedAtLength >= 0 && messages.length < failedAtLength + RETRY_AFTER_MESSAGES) {
					return undefined;
				}
				let decision;
				try {
					decision = await check(messages);
				} catch (err) {
					logger.warn({ error: err?.message }, "[summarization] trigger check failed");
					return undefined;
				}
				logger.info(
					{ tokens: decision.tokens, trigger, messages: messages.length, over: decision.over },
					"[summarization] trigger check",
				);
				if (!decision.over) return undefined;

				try {
					const threadId = runtime?.configurable?.thread_id;
					const result = await compactMessages({ messages, model, backend, keep, threadId });
					if (!result) {
						logger.info({ messages: messages.length }, "[summarization] nothing to compact");
						return undefined;
					}
					failedAtLength = -1;
					logger.info(
						{ summarized: result.summarized, kept: result.kept, offloadPath: result.offloadPath },
						"[summarization] compacted history",
					);
					try {
						onCompacted?.(result);
					} catch (err) {
						logger.warn({ error: err?.message }, "[summarization] onCompacted callback failed");
					}
					return { messages: [new RemoveMessage({ id: "__remove_all__" }), ...result.messages] };
				} catch (err) {
					// Leave state untouched; the 400 context-window handler is the safety net.
					failedAtLength = messages.length;
					logger.warn(
						{ error: err?.message },
						"[summarization] compaction failed; state unchanged",
					);
					return undefined;
				}
			},
		},
	});
}
