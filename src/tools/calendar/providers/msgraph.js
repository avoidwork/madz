import { Client } from "@microsoft/microsoft-graph-client";
import { CalendarProviderBase } from "./base.js";

/**
 * MS Graph API provider.
 */
export class MsGraphProvider extends CalendarProviderBase {
	type = "msgraph";

	/** @type {Client|null} */
	#client = null;

	/**
	 * @param {object} config - MS Graph config
	 */
	constructor(config) {
		super(config);
		this.#init(config);
	}

	/**
	 * Initialize MS Graph client.
	 * @param {object} config - MS Graph config
	 */
	#init(config) {
		if (config?.tenantId && config?.clientId && config?.clientSecret) {
			const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
			const authParams = new URLSearchParams({
				grant_type: "client_credentials",
				client_id: config.clientId,
				client_secret: config.clientSecret,
				scope: "https://graph.microsoft.com/.default",
			});

			this.#client = Client.init({
				authProvider: (done) => {
					fetch(authUrl, {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: authParams,
					})
						.then((res) => res.json())
						.then((data) => {
							done(null, data.access_token);
						})
						.catch((err) => done(err, null));
				},
			});
		}
	}

	/**
	 * Validate provider credentials.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateCredentials() {
		const errors = [];
		if (!this.#client) {
			errors.push("MS Graph credentials required: tenantId, clientId, clientSecret");
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
			const user = params.delegatedUser || "me";
			const response = await this.#client
				.api(`/users/${user}/calendarview`)
				.query({
					startdatetime: params.startDate,
					enddatetime: params.endDate,
					$top: params.maxResults || 50,
					$orderby: "start/dateTime",
				})
				.get();

			const events = (response.value || []).map((item) => ({
				eventId: item.id,
				title: item.subject || "Untitled",
				start: item.start?.dateTime,
				end: item.end?.dateTime,
				location: item.location?.displayName,
				description: item.body?.content,
				attendees: (item.attendees || []).map((a) => ({
					email: a.emailAddress?.address,
					type: a.type,
				})),
				organizer: item.organizer?.emailAddress?.address,
				status: item.showAs,
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
			const user = params.delegatedUser || "me";
			const event = {
				subject: params.title,
				body: { contentType: "HTML", content: params.description || "" },
				location: { displayName: params.location },
				start: { dateTime: params.start, timeZone: params.timezone || "UTC" },
				end: { dateTime: params.end, timeZone: params.timezone || "UTC" },
				attendees: params.attendees?.map((email) => ({
					emailAddress: { address: email },
					type: "required",
				})),
				reminders: {
					overrides: params.reminders?.map((r) => ({ method: r.method, minutes: r.minutes })),
				},
				showAs: params.visibility === "private" ? "busy" : "free",
			};

			const response = await this.#client.api(`/users/${user}/events`).post(event);

			return { ok: true, eventId: response.id };
		});
	}

	/**
	 * Update a calendar event.
	 * @param {object} params - Update parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async updateEvent(params) {
		return this._executeWithRetry(async () => {
			const user = params.delegatedUser || "me";
			const updates = {};
			if (params.title) updates.subject = params.title;
			if (params.description) updates.body = { contentType: "HTML", content: params.description };
			if (params.location) updates.location = { displayName: params.location };
			if (params.start)
				updates.start = { dateTime: params.start, timeZone: params.timezone || "UTC" };
			if (params.end) updates.end = { dateTime: params.end, timeZone: params.timezone || "UTC" };
			if (params.attendees)
				updates.attendees = params.attendees.map((email) => ({
					emailAddress: { address: email },
					type: "required",
				}));
			if (params.reminders)
				updates.reminders = {
					overrides: params.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
				};

			await this.#client.api(`/users/${user}/events/${params.eventId}`).patch(updates);
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
			const user = params.delegatedUser || "me";
			await this.#client.api(`/users/${user}/events/${params.eventId}`).delete();
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
			const user = params.delegatedUser || "me";
			const response = await this.#client.api("/users/me/calendar/views/getFreeBusys").post({
				schedules: [{ id: user, name: user }],
				timeConstraint: {
					timeZone: params.timezone || "UTC",
					timeSlots: { start: params.startDate, end: params.endDate },
				},
				requestedDuration: `PT${params.duration}M`,
			});

			const busyIntervals = [];
			for (const availability of response.value || []) {
				for (const busy of availability.busyTimes || []) {
					busyIntervals.push([busy.start.dateTime, busy.end.dateTime]);
				}
			}

			const slots = CalendarProviderBase.findFreeSlots(
				[params.startDate, params.endDate],
				[params.duration],
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
			const user = params.delegatedUser || "me";
			const response = await this.#client
				.api(`/users/${user}/calendarview`)
				.query({
					startdatetime:
						params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
					enddatetime: params.endDate || new Date().toISOString(),
					$top: 50,
					$orderby: "start/dateTime",
				})
				.get();

			const events = (response.value || []).map((item) => ({
				eventId: item.id,
				title: item.subject || "Untitled",
				start: item.start?.dateTime,
				end: item.end?.dateTime,
				description: item.body?.content,
				attendees: (item.attendees || []).map((a) => a.emailAddress?.address),
				location: item.location?.displayName,
			}));

			return { ok: true, summary: JSON.stringify(events, null, 2) };
		});
	}
}
