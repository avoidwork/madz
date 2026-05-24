let pendingSpans = [];

/**
 * Register a pending span for flush on shutdown.
 * @param {Object} span - The span export data
 */
export function queueSpan(span) {
	pendingSpans.push(span);
}

/**
 * Flush all pending spans. Returns the count flushed.
 * @returns {Promise<number>} Number of spans flushed
 */
export async function flushPending() {
	const count = pendingSpans.length;
	pendingSpans = [];
	return count;
}

/**
 * Clear all pending spans without flushing.
 * @returns {number} Number of cleared spans
 */
export function clearPending() {
	const count = pendingSpans.length;
	pendingSpans = [];
	return count;
}

/**
 * Get the current count of pending spans.
 * @returns {number}
 */
export function getPendingCount() {
	return pendingSpans.length;
}
