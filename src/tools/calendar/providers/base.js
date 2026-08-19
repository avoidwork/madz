/**
 * Base calendar provider interface.
 * All provider implementations MUST extend this class.
 */
export class CalendarProviderBase {
	/**
	 * @type {string} Provider type identifier
	 */
	type = "base";

	/**
	 * @type {number} Default timeout in milliseconds
	 */
	timeoutMs = 10000;

	/**
	 * @type {number} Default rate limit (requests per minute)
	 */
	rateLimit = 60;

	/**
	 * @type {number} Current rate limit window start timestamp
	 */
	#rateWindowStart = 0;

	/**
	 * @type {number} Requests made in current window
	 */
	#rateWindowCount = 0;

	/**
	 * Initialize the provider with config.
	 * @param {object} config - Calendar provider config from loadConfig()
	 */
	constructor(config) {
		if (config?.rateLimit?.requestsPerMinute) {
			this.rateLimit = config.rateLimit.requestsPerMinute;
		}
	}

	/**
	 * Check and enforce rate limiting.
	 * @returns {void}
	 */
	#enforceRateLimit() {
		const now = Date.now();
		const windowMs = 60000;

		if (now - this.#rateWindowStart > windowMs) {
			this.#rateWindowStart = now;
			this.#rateWindowCount = 0;
		}

		if (this.#rateWindowCount >= this.rateLimit) {
			const waitMs = windowMs - (now - this.#rateWindowStart);
			throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitMs / 1000)}s`);
		}

		this.#rateWindowCount++;
	}

	/**
	 * Execute an API call with timeout and rate limiting.
	 * @param {Function} fn - Async function to execute
	 * @param {number} [retries=3] - Max retry attempts
	 * @returns {Promise<*>} API response
	 */
	async _executeWithRetry(fn, retries = 3) {
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				this.#enforceRateLimit();
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

				try {
					return await fn({ signal: controller.signal });
				} finally {
					clearTimeout(timeoutId);
				}
			} catch (err) {
				if (err.message?.includes("Rate limit") && attempt < retries) {
					const waitMs = Math.pow(2, attempt) * 1000;
					await new Promise((r) => setTimeout(r, waitMs));
					continue;
				}

				if (err.name === "AbortError" || err.message?.includes("timeout")) {
					if (attempt < retries) {
						await new Promise((r) => setTimeout(r, 1000 * attempt));
						continue;
					}
					throw new Error(`Calendar API call timed out after ${retries} attempts`);
				}

				if (attempt < retries && (err.status === 429 || err.status === 500 || err.status === 503)) {
					const waitMs = Math.pow(2, attempt) * 1000;
					await new Promise((r) => setTimeout(r, waitMs));
					continue;
				}

				throw err;
			}
		}
	}

	/**
	 * Read calendar events.
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, events?: object[], error?: string }>}
	 */
	async readEvents(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Create a calendar event.
	 * @param {object} params - Create parameters
	 * @returns {Promise<{ ok: boolean, eventId?: string, error?: string }>}
	 */
	async createEvent(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Update a calendar event.
	 * @param {object} params - Update parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async updateEvent(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Delete a calendar event.
	 * @param {object} params - Delete parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteEvent(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Find available time slots.
	 * @param {object} params - Availability parameters
	 * @returns {Promise<{ ok: boolean, slots?: object[], error?: string }>}
	 */
	async findAvailability(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Generate a meeting summary.
	 * @param {object} params - Summary parameters
	 * @returns {Promise<{ ok: boolean, summary?: string, error?: string }>}
	 */
	async generateSummary(_params) {
		throw new Error("Not implemented");
	}

	/**
	 * Convert event times to a target timezone.
	 * @param {string} isoTime - ISO 8601 time string
	 * @param {string} timezone - Target IANA timezone
	 * @returns {string} Time in target timezone
	 */
	convertTimezone(isoTime, timezone) {
		if (timezone === "UTC" || !timezone) return isoTime;
		const date = new Date(isoTime);
		return date.toLocaleString("en-US", { timeZone: timezone });
	}

	/**
	 * Validate provider credentials.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateCredentials() {
		return { valid: true };
	}

	/**
	 * Find free time slots using busy interval sweep.
	 * @param {string} rangeStart - Start of search range (ISO 8601)
	 * @param {string} rangeEnd - End of search range (ISO 8601)
	 * @param {number} duration - Desired slot duration in minutes
	 * @param {string[][]|object[]} busy - Busy intervals as [[start, end], ...] or [{start, end}, ...]
	 * @returns {object[]} Free slots with start/end ISO 8601 strings
	 */
	static findFreeSlots(rangeStart, rangeEnd, duration, busy) {
		const rangeStartMs = new Date(rangeStart).getTime();
		const rangeEndMs = new Date(rangeEnd).getTime();
		const sortedBusy = (busy || [])
			.map((b) => ({
				start: new Date(b[0] || b.start).getTime(),
				end: new Date(b[1] || b.end).getTime(),
			}))
			.sort((a, b) => a.start - b.start);

		const freeSlots = [];
		let current = rangeStartMs;

		for (const b of sortedBusy) {
			if (b.start > rangeEndMs) break;
			if (b.start > current) {
				const gap = b.start - current;
				if (gap >= duration * 60 * 1000) {
					freeSlots.push({
						start: new Date(current).toISOString(),
						end: new Date(current + duration * 60 * 1000).toISOString(),
						duration,
					});
				}
			}
			if (b.end > current) current = b.end;
		}

		if (current < rangeEndMs) {
			const gap = rangeEndMs - current;
			if (gap >= duration * 60 * 1000) {
				freeSlots.push({
					start: new Date(current).toISOString(),
					end: new Date(current + duration * 60 * 1000).toISOString(),
					duration,
				});
			}
		}

		return freeSlots;
	}
}
