import { GoogleCalendarProvider } from "./google.js";
import { MsGraphProvider } from "./msgraph.js";
import { loadConfig } from "../../../config/loader.js";

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
	async #executeWithRetry(fn, retries = 3) {
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
	async readEvents(params) {
		throw new Error("Not implemented");
	}

	/**
	 * Create a calendar event.
	 * @param {object} params - Create parameters
	 * @returns {Promise<{ ok: boolean, eventId?: string, error?: string }>}
	 */
	async createEvent(params) {
		throw new Error("Not implemented");
	}

	/**
	 * Update a calendar event.
	 * @param {object} params - Update parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async updateEvent(params) {
		throw new Error("Not implemented");
	}

	/**
	 * Delete a calendar event.
	 * @param {object} params - Delete parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteEvent(params) {
		throw new Error("Not implemented");
	}

	/**
	 * Find available time slots.
	 * @param {object} params - Availability parameters
	 * @returns {Promise<{ ok: boolean, slots?: object[], error?: string }>}
	 */
	async findAvailability(params) {
		throw new Error("Not implemented");
	}

	/**
	 * Generate a meeting summary.
	 * @param {object} params - Summary parameters
	 * @returns {Promise<{ ok: boolean, summary?: string, error?: string }>}
	 */
	async generateSummary(params) {
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
	 * @param {string[]} range - [start, end] ISO 8601 timestamps
	 * @param {number[]} durations - Desired slot durations in minutes
	 * @param {string[][]} busy - Busy intervals as [[start, end], ...]
	 * @returns {object[]} Free slots with start/end ISO 8601 strings
	 */
	static findFreeSlots(range, durations, busy) {
		const [rangeStart, rangeEnd] = range.map((t) => new Date(t).getTime());
		const sortedBusy = busy
			.map(([s, e]) => ({ start: new Date(s).getTime(), end: new Date(e).getTime() }))
			.sort((a, b) => a.start - b.start);

		const freeSlots = [];
		let current = rangeStart;

		for (const busy of sortedBusy) {
			if (busy.start > rangeEnd) break;
			if (busy.start > current) {
				const gap = busy.start - current;
				for (const dur of durations) {
					if (gap >= dur * 60 * 1000) {
						freeSlots.push({
							start: new Date(current).toISOString(),
							end: new Date(current + dur * 60 * 1000).toISOString(),
							duration: dur,
						});
					}
				}
			}
			if (busy.end > current) current = busy.end;
		}

		if (current < rangeEnd) {
			const gap = rangeEnd - current;
			for (const dur of durations) {
				if (gap >= dur * 60 * 1000) {
					freeSlots.push({
						start: new Date(current).toISOString(),
						end: new Date(current + dur * 60 * 1000).toISOString(),
						duration: dur,
					});
				}
			}
		}

		return freeSlots;
	}
}

/**
 * Get the active calendar provider instance.
 * @param {object} [config] - Optional config override
 * @returns {CalendarProviderBase|null} Active provider or null
 */
export function getActiveCalendarProvider(config) {
	const cfg = config || loadConfig();
	const calendarConfig = cfg.calendar;

	if (!calendarConfig) {
		return null;
	}

	const activeType = calendarConfig.active || "google";

	if (activeType === "google") {
		return new GoogleCalendarProvider(calendarConfig.google);
	}

	if (activeType === "msgraph") {
		return new MsGraphProvider(calendarConfig.msgraph);
	}

	return null;
}