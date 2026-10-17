import { createMiddleware } from "langchain";
import { getRetryDelayMs } from "./openai.js";
import { logger } from "../shared/logger.js";

/** Default delay (ms) between Copilot 403 retries when no `retry-after` header is present. */
export const DEFAULT_COPILOT_RETRY_MS = 5_000;

/**
 * Create the Copilot 403 retry middleware.
 *
 * GitHub Copilot signals rate limiting with HTTP 403, not 429. The OpenAI SDK's
 * `shouldRetry` only retries on 408/409/429/>=500, so a Copilot 403 sails
 * straight through even when `maxRetries` is set. This middleware fills that
 * gap by retrying 403 responses for Copilot connections only.
 *
 * Enforcement lives in `wrapModelCall` rather than on the model instance,
 * because `ChatOpenAI.bindTools()` calls `withConfig()`, which constructs a
 * NEW model object — instance-property overrides of `invoke`/`stream` are
 * orphaned and never fire on the agent dispatch path. A middleware survives
 * because it is part of the agent's chain, not the model.
 *
 * Register it LAST in `createDeepAgent({ middleware: [...] })` so it is
 * innermost: it retries the raw model call, and the token-budget middleware
 * (which wraps it) charges the window once for the whole logical request.
 *
 * @param {Object} options - Middleware options
 * @param {number} [options.maxRetries] - Maximum retries after the initial
 *   attempt (default: 3). `0` disables retrying.
 * @param {Function} [options.sleep] - Sleep function in ms (injectable for tests)
 * @returns {Object} The middleware
 */
export function createCopilotRetryMiddleware(options = {}) {
	const maxRetries = options.maxRetries ?? 3;
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

	return createMiddleware({
		name: "CopilotRetry",
		async wrapModelCall(request, handler) {
			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				try {
					return await handler(request);
				} catch (err) {
					if (!isCopilotRateLimitError(err)) throw err;
					if (attempt === maxRetries) throw err;
					const delay = getRetryDelayMs(err, DEFAULT_COPILOT_RETRY_MS);
					logger.warn(
						{ attempt: attempt + 1, maxRetries, delayMs: delay },
						"[provider] Copilot 403 rate-limit hit; retrying",
					);
					await sleep(delay);
				}
			}
		},
	});
}

/**
 * Detect a Copilot 403 rate-limit error. Copilot uses 403 (not 429) for rate
 * limiting, so only 403 is retried here; 429 and >=500 are already handled by
 * the OpenAI SDK's own retry logic.
 * @param {Object} err - The caught error
 * @returns {boolean} True if the error is a 403
 */
function isCopilotRateLimitError(err) {
	const status = err?.status ?? err?.response?.status;
	return status === 403;
}
