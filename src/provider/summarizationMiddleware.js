import { createSummarizationMiddleware } from "deepagents";
import { countTokensApproximately } from "langchain";
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
 * When a `model` is supplied, the returned middleware is wrapped with a
 * preemptive context-window check: before dispatch it estimates the total cost
 * (input + expected output) using the model's real tokenizer and, when that
 * total would exceed the model's context window, forces a summarization before
 * the request is sent. This mirrors `estimateCost()` in the token-budget
 * middleware and prevents the reactive 400 context-window path.
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
 * @param {Object} [options.model] - The chat model, used to estimate token counts
 *   via `model.getNumTokensFromMessages(messages)` for the preemptive check
 * @param {number} [options.maxTokens] - Output token budget added to the estimate
 * @param {number} [options.contextWindow] - The model's context window length
 * @returns {Object|null} The summarization middleware, or `null` when disabled
 */
export function createSummarizationMiddlewareFromConfig(options = {}) {
	const { backend, config = {}, model, maxTokens, contextWindow } = options;
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

	const middleware = createSummarizationMiddleware({
		backend,
		trigger,
		keep,
	});

	// Wrap the library middleware with a preemptive context-window check. The
	// library's `shouldSummarize` only fires when the input token count
	// (estimated via `countTokensApproximately`, chars/4) exceeds the trigger.
	// It does not account for expected output tokens, so a long response can
	// push input + output over the window, causing 400 context-window errors
	// that are handled reactively (compact + re-send) rather than preemptively.
	// This wrapper estimates the total cost (input + output) using the model's
	// real tokenizer and compacts before dispatch when it would exceed the
	// window — mirroring `estimateCost()` in `tokenBudgetMiddleware.js`.
	if (model && typeof model.getNumTokensFromMessages === "function") {
		return wrapPreemptiveContextWindowCheck(middleware, {
			backend,
			keep,
			model,
			maxTokens,
			contextWindow,
		});
	}

	return middleware;
}

/**
 * Wrap a deepagents `SummarizationMiddleware` with a preemptive context-window
 * check that runs before dispatch.
 *
 * The wrapper estimates the total cost of the request (input tokens via the
 * model tokenizer + tool tokens + the configured output budget) and, when that
 * total would exceed the model's context window, forces a summarization through
 * an always-firing middleware before the request is sent. This prevents the
 * reactive 400 context-window path (compact + re-send) that the library
 * middleware otherwise relies on.
 *
 * @param {Object} middleware - The deepagents `SummarizationMiddleware`
 * @param {Object} options - Wrapper options
 * @param {Object} options.backend - The deepagents backend used for history offload
 * @param {Object} options.keep - The keep policy
 * @param {Object} options.model - The chat model used to estimate token counts
 * @param {number} [options.maxTokens] - Output token budget added to the estimate
 * @param {number} [options.contextWindow] - The model's context window length
 * @returns {Object} A middleware with the same name and `wrapModelCall`
 */
function wrapPreemptiveContextWindowCheck(
	middleware,
	{ backend, keep, model, maxTokens, contextWindow },
) {
	return {
		name: middleware.name,
		stateSchema: middleware.stateSchema,
		async wrapModelCall(request, handler) {
			const estimatedCost = await estimateContextCost(request, model, maxTokens);
			const window = contextWindow ?? (await resolveContextWindow(model));

			if (window && estimatedCost > window) {
				logger.warn(
					{ estimatedCost, contextWindow: window },
					"[summarization] preemptive context-window check triggered; compacting before dispatch",
				);
				// Force a summarization through an always-firing middleware. Its
				// `wrapModelCall` performs the summarization, dispatches the
				// compacted message set via the original handler, and returns a
				// `Command` carrying the summarization state updates.
				const forced = createSummarizationMiddleware({
					backend,
					trigger: { type: "messages", value: 0 },
					keep,
				});
				return forced.wrapModelCall(request, handler);
			}

			return middleware.wrapModelCall(request, handler);
		},
	};
}

/**
 * Estimate the total token cost of a model request: input tokens (system +
 * messages) plus tool tokens plus the configured output budget. Uses the
 * model's own tokenizer via `model.getNumTokensFromMessages(messages)` so the
 * estimate matches the model's actual tokenization.
 * @param {Object} request - The `wrapModelCall` request
 * @param {Object} model - The chat model
 * @param {number} [maxTokens] - Output token budget
 * @returns {Promise<number>} Estimated total token cost
 */
async function estimateContextCost(request, model, maxTokens) {
	const messages = request.messages ?? [];
	let inputTokens = 0;
	if (model && typeof model.getNumTokensFromMessages === "function") {
		const { totalCount } = await model.getNumTokensFromMessages(messages);
		inputTokens = totalCount;
	}
	let toolTokens = 0;
	if (request.tools && request.tools.length > 0) {
		toolTokens = countTokensApproximately([], request.tools);
	}
	// `-1` means unlimited / no cap — treat it as 0 (no output budget) so the
	// estimate is not off by one.
	const outputBudget = maxTokens === -1 ? 0 : maxTokens || 0;
	return inputTokens + toolTokens + outputBudget;
}

/**
 * Resolve the model's context window length from its profile, falling back to
 * the configured `contextWindow` when the profile does not expose one.
 * @param {Object} model - The chat model
 * @returns {Promise<number|undefined>} The context window length, or `undefined`
 */
async function resolveContextWindow(model) {
	const profile = model?.profile;
	if (
		profile &&
		typeof profile === "object" &&
		"maxInputTokens" in profile &&
		typeof profile.maxInputTokens === "number"
	) {
		return profile.maxInputTokens;
	}
	return undefined;
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
