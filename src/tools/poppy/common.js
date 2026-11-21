/**
 * Shared HTTP helpers for the Poppy (Personal Agent Protocol) tool.
 * @module tools/poppy/common
 */

/** Default fetch timeout in ms for Poppy HTTP calls. */
export const FETCH_TIMEOUT = 10000;

/**
 * Fetch a JSON resource over HTTPS, returning a normalized result. Supports
 * custom method, headers, body, timeout, and redirect handling.
 * @param {string} url - The URL to fetch
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Timeout in ms
 * @param {object} [options.headers] - Additional request headers
 * @param {string} [options.body] - Optional request body
 * @param {string} [options.method="GET"] - HTTP method
 * @param {string} [options.redirect="follow"] - Redirect mode ("follow" or "manual")
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function fetchJson(url, options = {}) {
	const timeout = options.timeout ?? FETCH_TIMEOUT;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(url, {
			method: options.method ?? "GET",
			headers: options.headers,
			body: options.body,
			redirect: options.redirect ?? "follow",
			signal: controller.signal,
		});
		if (!resp.ok) {
			let data = null;
			try {
				data = await resp.json();
			} catch {
				// Non-JSON error body; ignore.
			}
			return { ok: false, error: `HTTP error ${resp.status} fetching ${url}`, data };
		}
		const data = await resp.json();
		return { ok: true, data };
	} catch (err) {
		return { ok: false, error: err.message };
	} finally {
		clearTimeout(timeoutId);
	}
}
