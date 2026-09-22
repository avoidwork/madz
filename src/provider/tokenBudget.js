/**
 * Create a rolling token budget throttle for pacing LLM requests.
 * Maintains a sliding 60-second window of consumed tokens and delays
 * dispatch when the window is near capacity.
 *
 * The budget exposes an atomic `reserve` (wait + record under a lock), a
 * `reconcile` (adjust a reserved entry to actual usage), and a `release`
 * (remove a failed reservation). `consume`, `current`, and
 * `waitForCapacity` are retained for backward compatibility.
 * @param {number} maxTokensMinute - Rolling tokens-per-minute budget. 0 = disabled.
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.windowMs=60000] - Rolling window in milliseconds
 * @param {Function} [options.now] - Clock function returning current time in ms
 * @param {Function} [options.sleep] - Async sleep function (ms)
 * @returns {{consume: Function, current: Function, waitForCapacity: Function, reserve: Function, reconcile: Function, release: Function}} Token budget API
 */
export function createTokenBudget(maxTokensMinute, options = {}) {
	const windowMs = options.windowMs ?? 60_000;
	const now = options.now ?? (() => Date.now());
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const entries = [];
	let nextHandle = 1;
	// Promise-chain lock: each reservation awaits the previous one, so the
	// capacity check and the entry record are serialized and concurrent
	// dispatches cannot both pass the check and overshoot the window.
	let lock = Promise.resolve();

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
		entries.push({ timestamp: now(), tokens, handle: nextHandle++ });
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

	/**
	 * Atomically wait for capacity and record a consumption entry under the
	 * lock. Concurrent callers are serialized so the window cannot be
	 * overshot by parallel dispatches.
	 * @param {number} estimatedTokens - Estimated token cost of the request
	 * @returns {Promise<number|null>} A handle identifying the recorded entry,
	 *   or null when the budget is disabled
	 */
	function reserve(estimatedTokens) {
		if (maxTokensMinute <= 0) return Promise.resolve(null);
		// Serialize: await the previous operation before checking capacity and
		// recording, so concurrent callers cannot both pass the capacity check.
		const prev = lock;
		const op = (async () => {
			await prev;
			await waitForCapacity(estimatedTokens);
			const handle = nextHandle++;
			entries.push({ timestamp: now(), tokens: estimatedTokens, handle });
			return handle;
		})();
		// Keep the chain alive even if an operation rejects.
		lock = op.then(
			() => undefined,
			() => undefined,
		);
		return op;
	}

	/**
	 * Adjust the consumption entry identified by `handle` to `actualTokens`,
	 * replacing the pre-dispatch estimate with the real token total.
	 * Unknown handles are a no-op.
	 * @param {number} handle - Handle returned by `reserve`
	 * @param {number} actualTokens - Actual token total reported by the API
	 */
	function reconcile(handle, actualTokens) {
		if (maxTokensMinute <= 0) return;
		const entry = entries.find((e) => e.handle === handle);
		if (entry) entry.tokens = actualTokens;
	}

	/**
	 * Remove the consumption entry identified by `handle` so a failed
	 * dispatch does not leave its charge in the window. Unknown handles are
	 * a no-op.
	 * @param {number} handle - Handle returned by `reserve`
	 */
	function release(handle) {
		if (maxTokensMinute <= 0) return;
		const idx = entries.findIndex((e) => e.handle === handle);
		if (idx !== -1) entries.splice(idx, 1);
	}

	return { consume, current, waitForCapacity, reserve, reconcile, release };
}
