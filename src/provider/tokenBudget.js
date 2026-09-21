/**
 * Create a rolling token budget throttle for pacing LLM requests.
 * Maintains a sliding 60-second window of consumed tokens and delays
 * dispatch when the window is near capacity.
 * @param {number} maxTokensMinute - Rolling tokens-per-minute budget. 0 = disabled.
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.windowMs=60000] - Rolling window in milliseconds
 * @param {Function} [options.now] - Clock function returning current time in ms
 * @param {Function} [options.sleep] - Async sleep function (ms)
 * @returns {{consume: Function, current: Function, waitForCapacity: Function}} Token budget API
 */
export function createTokenBudget(maxTokensMinute, options = {}) {
	const windowMs = options.windowMs ?? 60_000;
	const now = options.now ?? (() => Date.now());
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const entries = [];

	/**
	 * Evict entries older than the window and return the current sum.
	 * @returns {number} Sum of tokens consumed within the last window
	 */
	function current() {
		const cutoff = now() - windowMs;
		while (entries.length > 0 && entries[0].timestamp <= cutoff) {
			entries.shift();
		}
		return entries.reduce((sum, entry) => sum + entry.tokens, 0);
	}

	/**
	 * Record a token consumption entry.
	 * @param {number} tokens - Number of tokens consumed
	 */
	function consume(tokens) {
		if (maxTokensMinute <= 0) return;
		entries.push({ timestamp: now(), tokens });
	}

	/**
	 * Wait until the rolling window has room for estimatedTokens.
	 * Resolves immediately when room is available; delays when the window
	 * is near capacity. A request larger than the whole budget waits until
	 * the window drains, then resolves (delay, not fail).
	 * @param {number} estimatedTokens - Estimated token cost of the request
	 * @returns {Promise<void>} Resolves once capacity is available
	 */
	async function waitForCapacity(estimatedTokens) {
		if (maxTokensMinute <= 0) return;
		while (current() + estimatedTokens > maxTokensMinute && current() > 0) {
			const oldest = entries[0];
			const waitMs = oldest.timestamp + windowMs - now();
			await sleep(waitMs > 0 ? waitMs : 1);
		}
	}

	return { consume, current, waitForCapacity };
}
