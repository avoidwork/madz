import { google } from "googleapis";
import { CalendarProviderBase } from "./base.js";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

/**
 * Google Calendar API provider.
 */
export class GoogleCalendarProvider extends CalendarProviderBase {
	type = "google";

	/** @type {google.calendar.v3.Calendar|null} */
	#calendar = null;

	/**
	 * @param {object} config - Google Calendar config
	 */
	constructor(config) {
		super(config);
		this.#init(config);
	}

	/**
	 * Initialize Google Calendar client.
	 * @param {object} config - Google Calendar config
	 */
	#init(config) {
		if (config?.serviceAccountKey) {
			let keyData;
			try {
				keyData = JSON.parse(config.serviceAccountKey);
			} catch {
				keyData = _require(config.serviceAccountKey);
			}
			const auth = new google.auth.JWT({
				email: config.serviceAccountEmail || keyData.client_email,
				key: keyData.private_key,
				scope: "https://www.googleapis.com/auth/calendar",
			});
			if (config.impersonateEmail) {
				auth.quotaUser = config.impersonateEmail;
			}
			this.#calendar = google.calendar({ version: "v3", auth });
		} else if (config?.apiKey) {
			this.#calendar = google.calendar({ version: "v3", apiKey: config.apiKey });
		}
	}

	/**
	 * Validate provider credentials.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateCredentials() {
		const errors = [];
		if (!this.#calendar) {
			errors.push(
				"No Google Calendar credentials configured (apiKey or serviceAccountKey required)",
			);
		}
		return { valid: errors.length === 0, errors };
	}

	/**
	 * Read calendar events.
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, events?: object[], error?: string }>}
	 */
	async readEvents(params) {
		return this._executeWithRetry(async () => {
			const calendarId = params.calendarId || "primary";
			const response = await this.#calendar.events.list({
				calendarId,
				timeMin: params.startDate,
				timeMax: params.endDate,
				maxResults: params.maxResults || 50,
				singleEvents: true,
				orderBy: "startTime",
				...(params.attendee ? { attendees: [params.attendee] } : {}),
				...(params.keyword ? { q: params.keyword } : {}),
			});

			const events = (response.data.items || []).map((item) => ({
				eventId: item.id,
				title: item.summary || "Untitled",
				start: item.start?.dateTime || item.start?.date,
				end: item.end?.dateTime || item.end?.date,
				location: item.location,
				description: item.description,
				attendees: (item.attendees || []).map((a) => a.email),
				organizer: item.organizer?.email,
				status: item.status,
				visibility: item.visibility,
			}));

			return { ok: true, events };
		});
	}

	/**
	 * Create a calendar event.
	 * @param {object} params - Create parameters
	 * @returns {Promise<{ ok: boolean, eventId?: string, error?: string }>}
	 */
	async createEvent(params) {
		return this._executeWithRetry(async () => {
			const calendarId = params.calendarId || "primary";
			const event = {
				summary: params.title,
				description: params.description,
				location: params.location,
				start: { dateTime: params.start, timeZone: params.timezone || "UTC" },
				end: { dateTime: params.end, timeZone: params.timezone || "UTC" },
				attendees: params.attendees?.map((email) => ({ email })),
				reminders: params.reminders
					? {
							overrides: params.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
						}
					: undefined,
				visibility: params.visibility,
			};

			const response = await this.#calendar.events.insert({
				calendarId,
				resource: event,
				sendUpdates: "all",
			});

			return { ok: true, eventId: response.data.id };
		});
	}

	/**
	 * Update a calendar event.
	 * @param {object} params - Update parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async updateEvent(params) {
		return this._executeWithRetry(async () => {
			const updates = {};
			if (params.title) updates.summary = params.title;
			if (params.description) updates.description = params.description;
			if (params.location) updates.location = params.location;
			if (params.start)
				updates.start = { dateTime: params.start, timeZone: params.timezone || "UTC" };
			if (params.end) updates.end = { dateTime: params.end, timeZone: params.timezone || "UTC" };
			if (params.attendees) updates.attendees = params.attendees.map((email) => ({ email }));
			if (params.reminders)
				updates.reminders = {
					overrides: params.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
				};
			if (params.visibility) updates.visibility = params.visibility;

			await this.#calendar.events.update({
				calendarId: params.calendarId || "primary",
				eventId: params.eventId,
				resource: updates,
				sendUpdates: "all",
			});

			return { ok: true };
		});
	}

	/**
	 * Delete a calendar event.
	 * @param {object} params - Delete parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteEvent(params) {
		return this._executeWithRetry(async () => {
			await this.#calendar.events.delete({
				calendarId: params.calendarId || "primary",
				eventId: params.eventId,
			});
			return { ok: true };
		});
	}

	/**
	 * Find available time slots.
	 * @param {object} params - Availability parameters
	 * @returns {Promise<{ ok: boolean, slots?: object[], error?: string }>}
	 */
	async findAvailability(params) {
		return this._executeWithRetry(async () => {
			const calendarId = params.calendarId || "primary";
			const response = await this.#calendar.freebusy.query({
				resource: {
					timeMin: params.startDate,
					timeMax: params.endDate,
					items: [{ id: calendarId }],
				},
			});

			const calendarBusy = response.data.calendars?.[calendarId]?.busy || [];
			const busyIntervals = calendarBusy.map((b) => [b.start, b.end]);
			const durations = [params.duration];
			const slots = CalendarProviderBase.findFreeSlots(
				[params.startDate, params.endDate],
				durations,
				busyIntervals,
			);

			return { ok: true, slots };
		});
	}

	/**
	 * Generate a meeting summary.
	 * @param {object} params - Summary parameters
	 * @returns {Promise<{ ok: boolean, summary?: string, error?: string }>}
	 */
	async generateSummary(params) {
		return this._executeWithRetry(async () => {
			const calendarId = params.calendarId || "primary";
			const response = await this.#calendar.events.list({
				calendarId,
				timeMin: params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
				timeMax: params.endDate || new Date().toISOString(),
				maxResults: 50,
				singleEvents: true,
				orderBy: "startTime",
			});

			const events = (response.data.items || []).map((item) => ({
				eventId: item.id,
				title: item.summary || "Untitled",
				start: item.start?.dateTime || item.start?.date,
				end: item.end?.dateTime || item.end?.date,
				description: item.description,
				attendees: (item.attendees || []).map((a) => a.email),
				location: item.location,
			}));

			if (params.eventId) {
				const single = events.filter((e) => e.eventId === params.eventId);
				return { ok: true, summary: JSON.stringify(single, null, 2) };
			}

			return { ok: true, summary: JSON.stringify(events, null, 2) };
		});
	}
}
