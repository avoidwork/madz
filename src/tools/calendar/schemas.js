import { z } from "zod";

// --- Timezone validation ---

/**
 * Validate an IANA timezone identifier.
 * @param {string} value - Timezone string
 * @returns {boolean}
 */
function isValidTimezone(value) {
	try {
		if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
			new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
			return true;
		}
	} catch {
		// ignore
	}
	return false;
}

const IanaTimezoneSchema = z
	.string()
	.min(1)
	.refine(
		(val) => {
			if (val === "UTC" || val === "local") return true;
			return isValidTimezone(val);
		},
		{ message: "Invalid IANA timezone identifier" },
	);

// --- Event schemas ---

/**
 * Schema for a calendar event (read/create/update).
 */
export const CalendarEventSchema = z.object({
	eventId: z.string().describe("Unique event identifier (for update/delete)"),
	title: z.string().min(1).describe("Event title"),
	start: z.string().describe("Event start time (ISO 8601 or parseable date string)"),
	end: z.string().describe("Event end time (ISO 8601 or parseable date string)"),
	location: z.string().optional().describe("Event location"),
	description: z.string().optional().describe("Event description"),
	attendees: z
		.array(z.string().email())
		.optional()
		.describe("List of attendee email addresses"),
	reminders: z
		.array(
			z.object({
				method: z.string().optional().default("popup"),
				minutes: z.number().int().positive(),
			}),
		)
		.optional()
		.describe("Reminders as [method, minutes] pairs"),
	visibility: z.enum(["default", "public", "private", "confidential"]).optional().default("default"),
});

/**
 * Schema for read action input.
 */
export const ReadEventSchema = z.object({
	action: z.literal("read"),
	startDate: z.string().describe("Start of date range (ISO 8601)"),
	endDate: z.string().describe("End of date range (ISO 8601)"),
	calendarId: z.string().optional().default("primary").describe("Calendar ID (default: primary)"),
	attendee: z.string().email().optional().describe("Filter by attendee email"),
	keyword: z.string().optional().describe("Filter by keyword in title/description"),
	timezone: IanaTimezoneSchema.optional().describe("IANA timezone for output (default: UTC)"),
	maxResults: z.number().int().positive().max(250).optional().default(50),
});

/**
 * Schema for create action input.
 */
export const CreateEventSchema = z.object({
	action: z.literal("create"),
	title: z.string().min(1).describe("Event title"),
	start: z.string().describe("Event start time (ISO 8601 or parseable date string)"),
	end: z.string().describe("Event end time (ISO 8601 or parseable date string)"),
	location: z.string().optional().describe("Event location"),
	description: z.string().optional().describe("Event description"),
	attendees: z
		.array(z.string().email())
		.optional()
		.describe("List of attendee email addresses"),
	reminders: z
		.array(
			z.object({
				method: z.string().optional().default("popup"),
				minutes: z.number().int().positive(),
			}),
		)
		.optional()
		.describe("Reminders as [method, minutes] pairs"),
	visibility: z.enum(["default", "public", "private", "confidential"]).optional().default("default"),
	timezone: IanaTimezoneSchema.optional().describe("IANA timezone for event times"),
});

/**
 * Schema for update action input.
 */
export const UpdateEventSchema = z.object({
	action: z.literal("update"),
	eventId: z.string().min(1).describe("Event ID to update"),
	title: z.string().min(1).optional().describe("New event title"),
	start: z.string().optional().describe("New start time"),
	end: z.string().optional().describe("New end time"),
	location: z.string().optional().describe("New location"),
	description: z.string().optional().describe("New description"),
	attendees: z
		.array(z.string().email())
		.optional()
		.describe("New list of attendee email addresses"),
	reminders: z
		.array(
			z.object({
				method: z.string().optional().default("popup"),
				minutes: z.number().int().positive(),
			}),
		)
		.optional()
		.describe("New reminders"),
	visibility: z.enum(["default", "public", "private", "confidential"]).optional().describe("New visibility"),
});

/**
 * Schema for delete action input.
 */
export const DeleteEventSchema = z.object({
	action: z.literal("delete"),
	eventId: z.string().min(1).describe("Event ID to delete"),
});

/**
 * Schema for availability action input.
 */
export const AvailabilitySchema = z.object({
	action: z.literal("availability"),
	startDate: z.string().describe("Start of search range (ISO 8601)"),
	endDate: z.string().describe("End of search range (ISO 8601)"),
	duration: z
		.number()
		.int()
		.positive()
		.describe("Desired slot duration in minutes"),
	calendarId: z.string().optional().default("primary").describe("Calendar ID (default: primary)"),
	timezone: IanaTimezoneSchema.optional().describe("IANA timezone for output"),
});

/**
 * Schema for summary action input.
 */
export const SummarySchema = z.object({
	action: z.literal("summary"),
	startDate: z.string().optional().describe("Start of range (ISO 8601)"),
	endDate: z.string().optional().describe("End of range (ISO 8601)"),
	eventId: z.string().optional().describe("Single event ID (overrides date range)"),
	calendarId: z.string().optional().default("primary").describe("Calendar ID (default: primary)"),
});

/**
 * Union schema for all calendar actions.
 */
export const CalendarToolSchema = z.discriminatedUnion("action", [
	ReadEventSchema,
	CreateEventSchema,
	UpdateEventSchema,
	DeleteEventSchema,
	AvailabilitySchema,
	SummarySchema,
]);

/**
 * Google Calendar provider config schema.
 */
export const GoogleCalendarConfigSchema = z.object({
	type: z.literal("google").default("google"),
	apiKey: z.string().optional().default(""),
	serviceAccountKey: z.string().optional().default(""),
	impersonateEmail: z.string().email().optional().default(""),
});

/**
 * MS Graph provider config schema.
 */
export const MsGraphConfigSchema = z.object({
	type: z.literal("msgraph").default("msgraph"),
	tenantId: z.string().optional().default(""),
	clientId: z.string().optional().default(""),
	clientSecret: z.string().optional().default(""),
});

/**
 * Calendar provider config schema.
 */
export const CalendarProviderConfigSchema = z.object({
	active: z.enum(["google", "msgraph"]).default("google"),
	google: GoogleCalendarConfigSchema.default({}),
	msgraph: MsGraphConfigSchema.default({}),
});