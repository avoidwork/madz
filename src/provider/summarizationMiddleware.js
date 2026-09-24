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

	return createSummarizationMiddleware({
		backend,
		trigger,
		keep,
	});
}
