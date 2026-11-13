import { createMiddleware } from "langchain";
import { getRetryDelayMs } from "./openai.js";
import { logger } from "../shared/logger.js";

/** Default delay (ms) between Copilot 403 retries when no `retry-after` header is present. */
export const DEFAULT_COPILOT_RETRY_MS = 10_000;

/** Upper bound (ms) for a single backoff delay. */
const MAX_COPILOT_RETRY_MS = 120_000;

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
 * @param {Function} [options.sleep] - Sleep function `(ms, signal)` (injectable for tests)
 * @returns {Object} The middleware
 */
export function createCopilotRetryMiddleware(options = {}) {
	const maxRetries = options.maxRetries ?? 3;
	const sleep = options.sleep ?? abortableSleep;

	return createMiddleware({
		name: "CopilotRetry",
		async wrapModelCall(request, handler) {
			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				try {
					return await handler(request);
				} catch (err) {
					if (!isCopilotRateLimitError(err)) throw err;
					if (attempt === maxRetries) throw err;
					if (request?.signal?.aborted) throw err;
					// A retry-after header wins; otherwise back off exponentially
					// with jitter, capped.
					const hasHint = hasRetryAfter(err);
					const delay = hasHint
						? getRetryDelayMs(err, DEFAULT_COPILOT_RETRY_MS)
						: Math.min(
								MAX_COPILOT_RETRY_MS,
								DEFAULT_COPILOT_RETRY_MS * 2 ** attempt * (0.5 + Math.random() * 0.5),
							);
					logger.warn(
						{ attempt: attempt + 1, maxRetries, delayMs: delay },
						"[provider] Copilot 403 rate-limit hit; retrying",
					);
					await sleep(delay, request?.signal);
				}
			}
		},
	});
}

/**
 * Sleep that rejects early when the signal aborts.
 * @param {number} ms - Delay in milliseconds
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<void>} Resolves after the delay
 */
function abortableSleep(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(signal.reason ?? new Error("Aborted"));
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason ?? new Error("Aborted"));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * Whether the error carries a `retry-after` header.
 * @param {Object} err - The caught error
 * @returns {boolean} True when a retry-after header is present
 */
function hasRetryAfter(err) {
	for (const h of [err?.headers, err?.response?.headers]) {
		if (!h) continue;
		const v =
			typeof h.get === "function"
				? h.get("retry-after")
				: Object.entries(h).find(([k]) => k.toLowerCase() === "retry-after")?.[1];
		if (v !== undefined && v !== null && String(v).trim() !== "") return true;
	}
	return false;
}

/**
 * Detect a Copilot 403 rate-limit error. Copilot uses 403 (not 429) for rate
 * limiting, so a 403 is retried only when it carries a `retry-after` header or
 * a rate-limit message; other 403s (auth, policy) fail fast. 429 and >=500 are
 * already handled by the OpenAI SDK's own retry logic. This middleware is only
 * registered for Copilot connections.
 * @param {Object} err - The caught error
 * @returns {boolean} True if the error is a rate-limit 403
 */
function isCopilotRateLimitError(err) {
	const status = err?.status ?? err?.response?.status;
	if (status !== 403) return false;
	if (hasRetryAfter(err)) return true;
	const message = String(err?.message ?? err?.error?.message ?? "");
	return /rate.?limit|too many requests|abuse|secondary/i.test(message);
}
