export const DEFAULT_RATE_LIMIT = 10; // requests per second, per host

const WINDOW_MS = 1000;
const PRUNE_THRESHOLD = 256;

/**
 * Default sleep implementation.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a sliding-window rate limiter keyed by an arbitrary string (the API tool
 * keys it by host). `acquire` re-checks the window after every wait, so concurrent
 * callers can never collectively exceed the limit. Stale keys are pruned lazily —
 * no background timer.
 * @param {object} [options]
 * @param {number} [options.maxPerSecond=10] - Requests per second per key; `0` disables limiting
 * @param {() => number} [options.now] - Clock override (tests)
 * @param {(ms: number) => Promise<void>} [options.sleep] - Sleep override (tests)
 * @returns {{ acquire: (key: string) => Promise<void>, size: () => number }}
 */
export function createRateLimiter({
	maxPerSecond = DEFAULT_RATE_LIMIT,
	now = Date.now,
	sleep = defaultSleep,
} = {}) {
	const windows = new Map();

	/**
	 * Drop keys whose timestamps have all expired.
	 * @param {number} t - Current time
	 */
	function prune(t) {
		const stale = [];
		for (const [key, timestamps] of windows) {
			if (timestamps.every((ts) => ts <= t - WINDOW_MS)) stale.push(key);
		}
		for (const key of stale) windows.delete(key);
	}

	return {
		async acquire(key) {
			if (!maxPerSecond || maxPerSecond <= 0) return;
			for (;;) {
				const t = now();
				const recent = (windows.get(key) ?? []).filter((ts) => ts > t - WINDOW_MS);
				if (recent.length < maxPerSecond) {
					recent.push(t);
					windows.set(key, recent);
					if (windows.size > PRUNE_THRESHOLD) prune(t);
					return;
				}
				windows.set(key, recent);
				await sleep(recent[0] + WINDOW_MS - t + 1);
			}
		},
		size: () => windows.size,
	};
}
