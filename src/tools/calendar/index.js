import { tool } from "@langchain/core/tools";
import { getActiveCalendarProvider } from "./providers/factory.js";
import { CalendarToolSchema } from "./schemas.js";
import { CalendarProviderBase } from "./providers/base.js";

/**
 * Re-export for testing and external use.
 */
export { CalendarProviderBase } from "./providers/base.js";
export const findFreeSlots = CalendarProviderBase.findFreeSlots.bind(CalendarProviderBase);

/**
 * Calendar management tool — read, create, update, delete events, check availability, generate summaries.
 * @param {z.infer<typeof CalendarToolSchema>} input - Tool input with action and params
 * @param {object} [options] - Runtime options
 * @returns {Promise<object>} Result object
 */
export async function calendarImpl(input, options) {
	const { action } = input;

	const validActions = ["read", "create", "update", "delete", "availability", "summary"];

	if (!validActions.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${validActions.join(", ")}`,
		};
	}

	const provider = getActiveCalendarProvider(options?.config);
	if (!provider) {
		return {
			ok: false,
			error:
				"No calendar provider configured. Set up calendar credentials via environment variables.",
		};
	}

	const validation = provider.validateCredentials();
	if (!validation.valid) {
		return {
			ok: false,
			error: `Invalid calendar provider config: ${validation.errors?.join("; ")}`,
		};
	}

	switch (action) {
		case "read": {
			const { startDate, endDate } = input;
			if (!startDate) {
				return { ok: false, error: "startDate is required for read action" };
			}
			const effectiveEnd = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			try {
				const result = await provider.readEvents({ ...input, endDate: effectiveEnd });
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, count: result.events?.length || 0, events: result.events };
			} catch (err) {
				return { ok: false, error: `Calendar read failed: ${err.message}` };
			}
		}

		case "create": {
			const { title, start, end } = input;
			if (!title) {
				return { ok: false, error: "title is required for create action" };
			}
			if (!start || !end) {
				return { ok: false, error: "start and end times are required for create action" };
			}
			try {
				const result = await provider.createEvent(input);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, eventId: result.eventId };
			} catch (err) {
				return { ok: false, error: `Calendar create failed: ${err.message}` };
			}
		}

		case "update": {
			const { eventId } = input;
			if (!eventId) {
				return { ok: false, error: "eventId is required for update action" };
			}
			try {
				const result = await provider.updateEvent(input);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, eventId };
			} catch (err) {
				return { ok: false, error: `Calendar update failed: ${err.message}` };
			}
		}

		case "delete": {
			const { eventId } = input;
			if (!eventId) {
				return { ok: false, error: "eventId is required for delete action" };
			}
			try {
				const result = await provider.deleteEvent(input);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, eventId };
			} catch (err) {
				return { ok: false, error: `Calendar delete failed: ${err.message}` };
			}
		}

		case "availability": {
			const { startDate, endDate, duration } = input;
			if (!startDate || !duration) {
				return {
					ok: false,
					error: "startDate and duration (minutes) are required for availability action",
				};
			}
			const effectiveEnd = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			try {
				const result = await provider.findAvailability({ ...input, endDate: effectiveEnd });
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, slots: result.slots };
			} catch (err) {
				return { ok: false, error: `Calendar availability failed: ${err.message}` };
			}
		}

		case "summary": {
			const { startDate, endDate } = input;
			if (!startDate) {
				return { ok: false, error: "startDate is required for summary action" };
			}
			const effectiveEnd = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			try {
				const result = await provider.generateSummary({ ...input, endDate: effectiveEnd });
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, summary: result.summary };
			} catch (err) {
				return { ok: false, error: `Calendar summary failed: ${err.message}` };
			}
		}

		default:
			return { ok: false, error: `Unknown action: "${action}"` };
	}
}

/**
 * Calendar management tool instance.
 */
export const calendar = tool(calendarImpl, {
	name: "calendar",
	description:
		"Manage calendar events: read events by date range, create new meetings, update existing events, delete events, find free time slots, and generate meeting summaries. Supports Google Calendar and MS Graph providers.",
	schema: CalendarToolSchema,
});
