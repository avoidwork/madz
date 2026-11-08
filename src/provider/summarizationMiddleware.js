import { createSummarizationMiddleware } from "deepagents";
import { logger } from "../shared/logger.js";

/**
 * Build the deepagents `SummarizationMiddleware` from madz config.
 *
 * When `enabled` is false (or the section is absent), this returns `null` so
 * the caller can spread it conditionally — a true no-op that reproduces today's
 * behavior exactly (deepagents' library default: 170k token trigger / keep last
 * 6 messages).
 *
 * When enabled, it returns `createSummarizationMiddleware({ backend, trigger,
 * keep })` with `trigger` and `keep` passed **explicitly**.
 * This is required because deepagents' `createSummarizationMiddleware` defaults
 * `keep` to `{ type: "messages", value: 20 }` when a `trigger` is supplied
 * without a `keep` — silently moving keep from the fallback 6 → 20. madz always
 * passes both to preserve the configured policy.
 *
 * The returned middleware is named `SummarizationMiddleware` (the library
 * default name), so `mergeMiddlewareStack` in `createDeepAgent` displaces the
 * built-in entry via same-name replacement.
 *
 * NOTE — subagent propagation: this custom middleware reaches the orchestrator
 * only. deepagents' `buildSubagentMiddleware` merges the orchestrator's custom
 * middleware into a subagent stack only when the subagent is forked
 * (`mode: "fork"`). madz's subagents are not forked, so they keep the library
 * default `SummarizationMiddleware` (170k trigger / keep 6). See design.md.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.backend - The deepagents backend used for history offload
 * @param {Object} [options.config] - The resolved `summarization` config section
 * @returns {Object|null} The summarization middleware, or `null` when disabled
 */
export function createSummarizationMiddlewareFromConfig(options = {}) {
	const { backend, config = {} } = options;
	const enabled = config.enabled === true;

	if (!enabled) return null;

	const trigger = config.trigger;
	const keep = config.keep;

	if (!trigger || !keep) {
		logger.warn(
			{ trigger, keep },
			"[summarization] enabled but missing trigger/keep; falling back to library defaults",
		);
		return null;
	}

	logger.info({ trigger, keep }, "[summarization] registering custom SummarizationMiddleware");

	const inner = createSummarizationMiddleware({
		backend,
		trigger,
		keep,
	});

	// The library compares `countTokensApproximately` (~chars/4) against the
	// trigger, which disagrees with the real tokenizer the status bar uses, so
	// the middleware can sit idle while the status bar already reports >80%.
	// When a real token counter is supplied, decide with it instead.
	if (typeof options.tokenCounter !== "function" || trigger.type !== "tokens") {
		return inner;
	}
	return wrapWithTokenCounter({
		inner,
		forced: createSummarizationMiddleware({
			backend,
			trigger: { type: "messages", value: 0 },
			keep,
		}),
		threshold: trigger.value,
		tokenCounter: options.tokenCounter,
	});
}

/**
 * Reconstruct the messages the model would actually be sent, mirroring the
 * library's `getEffectiveMessages`: after a summarization event the effective
 * list is the summary message plus everything from the cutoff onward.
 * @param {Array} messages - Raw state messages
 * @param {Object} [state] - Agent state (may carry `_summarizationEvent`)
 * @returns {Array} Effective messages
 */
function effectiveMessages(messages, state) {
	const event = state?._summarizationEvent;
	if (!event) return messages;
	return [event.summaryMessage, ...messages.slice(event.cutoffIndex)];
}

/**
 * Wrap the library middleware so the "should we summarize" decision uses an
 * accurate token counter. Over threshold -> delegate to `forced` (a
 * middleware whose trigger always fires, same keep policy). Otherwise -> the
 * normal `inner` middleware, which keeps its context-overflow safety net.
 * Any counter failure falls through to `inner` (library behavior).
 * @param {Object} params - Wrap parameters
 * @param {Object} params.inner - The configured library middleware
 * @param {Object} params.forced - Same middleware with an always-firing trigger
 * @param {number} params.threshold - Token threshold to fire at
 * @param {Function} params.tokenCounter - async (messages) => token count
 * @returns {Object} Middleware named `SummarizationMiddleware`
 */
function wrapWithTokenCounter({ inner, forced, threshold, tokenCounter }) {
	return {
		...inner,
		wrapModelCall: async (request, handler) => {
			let over = false;
			try {
				const messages = effectiveMessages(request.messages ?? [], request.state);
				const counted = request.systemMessage ? [request.systemMessage, ...messages] : messages;
				if (messages.length > 0) {
					const tokens = await tokenCounter(counted);
					over = tokens >= threshold;
					logger.debug({ tokens, threshold, over }, "[summarization] token check");
				}
			} catch (err) {
				logger.warn(
					{ error: err.message },
					"[summarization] token counter failed; using library estimate",
				);
			}
			return (over ? forced : inner).wrapModelCall(request, handler);
		},
	};
}

/**
 * Force a summarization through the deepagents `SummarizationMiddleware`,
 * bypassing the configured trigger threshold. Used by the `/compact` command.
 *
 * Creates a fresh middleware with an always-firing trigger, invokes its
 * `wrapModelCall` with a capture handler, and returns the modified message set
 * (summary message + preserved messages). The offload to backend storage is
 * best-effort — a failure logs a warning and proceeds with summary generation.
 *
 * @param {Object} options - Options
 * @param {Object} options.backend - The deepagents backend used for history offload
 * @param {Object} [options.keep] - The keep policy (defaults to messages/20)
 * @param {Object} options.state - The agent state values (with `messages`)
 * @param {Object} options.model - The chat model used to generate the summary
 * @returns {Promise<Array>} The modified message set (summary + preserved)
 */
export async function forceSummarize(options = {}) {
	const { backend, keep = { type: "messages", value: 20 }, state, model } = options;
	const middleware = createSummarizationMiddleware({
		backend,
		trigger: { type: "messages", value: 0 },
		keep,
	});
	let captured = null;
	await middleware.wrapModelCall(
		{ state, messages: state.messages, model, systemMessage: null, tools: [] },
		async (req) => {
			captured = req.messages;
			return req;
		},
	);
	return captured;
}
