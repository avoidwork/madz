import { describe, it } from "node:test";
import assert from "node:assert/strict";

// --- Helpers ---

/**
 * Create a mock config object for calendar tools.
 * @param {object} opts - Configuration overrides
 * @returns {object} Config object
 */
function createMockConfig(opts = {}) {
	const base = {
		calendar: {
			active: opts.active || "google",
			google: {
				type: "google",
				apiKey: opts.googleApiKey || "mock-api-key",
				rateLimit: { requestsPerMinute: 60 },
			},
			msgraph: {
				type: "msgraph",
				tenantId: opts.msgraphTenantId || "mock-tenant-id",
				clientId: opts.msgraphClientId || "mock-client-id",
				clientSecret: opts.msgraphClientSecret || "mock-client-secret",
				rateLimit: { requestsPerMinute: 60 },
			},
		},
	};
	return base;
}

// --- Schema Tests ---

import {
	ReadEventSchema,
	CreateEventSchema,
	UpdateEventSchema,
	DeleteEventSchema,
	AvailabilitySchema,
	SummarySchema,
	CalendarToolSchema,
	GoogleCalendarConfigSchema,
	MsGraphConfigSchema,
	CalendarProviderConfigSchema,
} from "../../../src/tools/calendar/schemas.js";

describe("Calendar Schemas", () => {
	describe("ReadEventSchema", () => {
		it("should validate minimal read request", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate full read request", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
				endDate: "2025-01-02T00:00:00Z",
				calendarId: "primary",
				attendee: "user@example.com",
				keyword: "meeting",
				maxResults: 10,
				timezone: "America/New_York",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject missing startDate", () => {
			const result = ReadEventSchema.safeParse({});
			assert.strictEqual(result.success, false);
		});

		it("should reject maxResults below 1", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
				maxResults: 0,
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("CreateEventSchema", () => {
		it("should validate minimal create request", () => {
			const result = CreateEventSchema.safeParse({
				action: "create",
				title: "Team Standup",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate full create request", () => {
			const result = CreateEventSchema.safeParse({
				action: "create",
				title: "Team Standup",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
				location: "Conference Room A",
				description: "Daily standup",
				attendees: ["user1@example.com", "user2@example.com"],
				reminders: [{ method: "popup", minutes: 15 }],
				visibility: "default",
				timezone: "America/New_York",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject missing title", () => {
			const result = CreateEventSchema.safeParse({
				action: "create",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
			});
			assert.strictEqual(result.success, false);
		});

		it("should reject invalid attendee email", () => {
			const result = CreateEventSchema.safeParse({
				action: "create",
				title: "Test",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
				attendees: ["not-an-email"],
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("UpdateEventSchema", () => {
		it("should validate minimal update request", () => {
			const result = UpdateEventSchema.safeParse({
				action: "update",
				eventId: "evt-123",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate full update request", () => {
			const result = UpdateEventSchema.safeParse({
				action: "update",
				eventId: "evt-123",
				title: "Updated Title",
				start: "2025-01-02T10:00:00Z",
				end: "2025-01-02T11:00:00Z",
				location: "New Location",
				description: "Updated description",
				attendees: ["user3@example.com"],
				visibility: "private",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("DeleteEventSchema", () => {
		it("should validate delete request", () => {
			const result = DeleteEventSchema.safeParse({
				action: "delete",
				eventId: "evt-123",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject empty eventId", () => {
			const result = DeleteEventSchema.safeParse({
				action: "delete",
				eventId: "",
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("AvailabilitySchema", () => {
		it("should validate minimal availability request", () => {
			const result = AvailabilitySchema.safeParse({
				action: "availability",
				startDate: "2025-01-01T00:00:00Z",
				duration: 30,
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate full availability request", () => {
			const result = AvailabilitySchema.safeParse({
				action: "availability",
				startDate: "2025-01-01T00:00:00Z",
				endDate: "2025-01-01T23:59:59Z",
				duration: 30,
				calendarId: "primary",
				timezone: "America/New_York",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject zero duration", () => {
			const result = AvailabilitySchema.safeParse({
				action: "availability",
				startDate: "2025-01-01T00:00:00Z",
				duration: 0,
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("SummarySchema", () => {
		it("should validate minimal summary request", () => {
			const result = SummarySchema.safeParse({
				action: "summary",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate full summary request", () => {
			const result = SummarySchema.safeParse({
				action: "summary",
				startDate: "2025-01-01T00:00:00Z",
				endDate: "2025-01-07T23:59:59Z",
				eventId: "evt-123",
				calendarId: "primary",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("CalendarToolSchema", () => {
		it("should validate read action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate create action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "create",
				title: "Test",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate update action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "update",
				eventId: "evt-123",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate delete action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "delete",
				eventId: "evt-123",
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate availability action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "availability",
				startDate: "2025-01-01T00:00:00Z",
				duration: 30,
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate summary action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "summary",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject invalid action", () => {
			const result = CalendarToolSchema.safeParse({
				action: "invalid",
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("GoogleCalendarConfigSchema", () => {
		it("should validate minimal config", () => {
			const result = GoogleCalendarConfigSchema.safeParse({});
			assert.strictEqual(result.success, true);
		});

		it("should validate full config", () => {
			const result = GoogleCalendarConfigSchema.safeParse({
				apiKey: "test-key",
				serviceAccountKey: '{"type":"service_account"}',
				impersonateEmail: "admin@example.com",
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject invalid impersonateEmail", () => {
			const result = GoogleCalendarConfigSchema.safeParse({
				impersonateEmail: "not-an-email",
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("MsGraphConfigSchema", () => {
		it("should validate minimal config", () => {
			const result = MsGraphConfigSchema.safeParse({});
			assert.strictEqual(result.success, true);
		});

		it("should validate full config", () => {
			const result = MsGraphConfigSchema.safeParse({
				tenantId: "tenant-123",
				clientId: "client-456",
				clientSecret: "secret-789",
			});
			assert.strictEqual(result.success, true);
		});
	});

	describe("CalendarProviderConfigSchema", () => {
		it("should validate default config", () => {
			const result = CalendarProviderConfigSchema.safeParse({});
			assert.strictEqual(result.success, true);
		});

		it("should validate with active provider", () => {
			const result = CalendarProviderConfigSchema.safeParse({
				active: "google",
				google: { apiKey: "test-key" },
			});
			assert.strictEqual(result.success, true);
		});

		it("should validate with msgraph active", () => {
			const result = CalendarProviderConfigSchema.safeParse({
				active: "msgraph",
				msgraph: { tenantId: "t-123", clientId: "c-456", clientSecret: "s-789" },
			});
			assert.strictEqual(result.success, true);
		});

		it("should reject invalid active provider", () => {
			const result = CalendarProviderConfigSchema.safeParse({
				active: "invalid",
			});
			assert.strictEqual(result.success, false);
		});
	});
});

// --- CalendarProviderBase Tests ---

import { CalendarProviderBase, findFreeSlots } from "../../../src/tools/calendar/providers/base.js";

describe("Calendar Provider", () => {
	describe("CalendarProviderBase", () => {
		it("should have correct type", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.type, "base");
		});

		it("should have default timeout", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.timeoutMs, 10000);
		});

		it("should have default rate limit", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.rateLimit, 60);
		});

		it("should apply rate limit from config", () => {
			const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 30 } });
			assert.strictEqual(provider.rateLimit, 30);
		});

		it("should validate credentials by default", () => {
			const provider = new CalendarProviderBase();
			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, true);
		});

		it("should throw on readEvents", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.readEvents({}));
		});

		it("should throw on createEvent", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.createEvent({}));
		});

		it("should throw on updateEvent", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.updateEvent({}));
		});

		it("should throw on deleteEvent", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.deleteEvent({}));
		});

		it("should throw on findAvailability", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.findAvailability({}));
		});

		it("should throw on generateSummary", () => {
			const provider = new CalendarProviderBase();
			assert.rejects(() => provider.generateSummary({}));
		});

		it("should convert timezone", () => {
			const provider = new CalendarProviderBase();
			const result = provider.convertTimezone("2025-01-01T12:00:00Z", "America/New_York");
			assert.ok(typeof result === "string");
		});

		it("should return original for UTC", () => {
			const provider = new CalendarProviderBase();
			const result = provider.convertTimezone("2025-01-01T12:00:00Z", "UTC");
			assert.strictEqual(result, "2025-01-01T12:00:00Z");
		});

		it("should return original for no timezone", () => {
			const provider = new CalendarProviderBase();
			const result = provider.convertTimezone("2025-01-01T12:00:00Z", "");
			assert.strictEqual(result, "2025-01-01T12:00:00Z");
		});
	});

	describe("findFreeSlots", () => {
		it("should find free slot in empty calendar", () => {
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, []);
			assert.ok(slots.length > 0);
			assert.ok(new Date(slots[0].start) >= new Date("2025-01-01T00:00:00Z"));
		});

		it("should skip busy intervals", () => {
			const busy = [
				{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T10:00:00Z" },
				{ start: "2025-01-01T14:00:00Z", end: "2025-01-01T15:00:00Z" },
			];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			assert.ok(slots.length > 0);
			// No slot should overlap with busy intervals
			for (const slot of slots) {
				for (const b of busy) {
					const slotStart = new Date(slot.start).getTime();
					const slotEnd = new Date(slot.end).getTime();
					const busyStart = new Date(b.start).getTime();
					const busyEnd = new Date(b.end).getTime();
					assert.ok(
						slotEnd <= busyStart || slotStart >= busyEnd,
						`Slot ${slot.start}-${slot.end} overlaps with busy ${b.start}-${b.end}`,
					);
				}
			}
		});

		it("should return empty array when all time is busy", () => {
			const busy = [{ start: "2025-01-01T00:00:00Z", end: "2025-01-01T23:59:59Z" }];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			assert.strictEqual(slots.length, 0);
		});

		it("should find slot between busy intervals", () => {
			const busy = [
				{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T10:00:00Z" },
				{ start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
			];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			// Should find slots before 9am and after 11am
			const hasMorningSlot = slots.some(
				(s) => new Date(s.start).getTime() < new Date("2025-01-01T09:00:00Z").getTime(),
			);
			const hasEveningSlot = slots.some(
				(s) => new Date(s.start).getTime() > new Date("2025-01-01T11:00:00Z").getTime(),
			);
			assert.ok(hasMorningSlot || hasEveningSlot, "Should find at least one free slot");
		});
	});
});

// --- Calendar Tool Integration Tests ---

import { calendar, calendarImpl } from "../../../src/tools/calendar/index.js";

describe("Calendar Tool Integration", () => {
	describe("calendar tool", () => {
		it("should be a valid LangChain tool", () => {
			assert.ok(calendar);
			assert.strictEqual(calendar.name, "calendar");
			assert.ok(typeof calendar.description === "string");
			assert.ok(calendar.description.length > 0);
		});

		it("should reject unknown action", async () => {
			const result = await calendarImpl({ action: "invalid" }, { config: createMockConfig() });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Unknown action"));
		});

		it("should reject read without startDate", async () => {
			const result = await calendarImpl({ action: "read" }, { config: createMockConfig() });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("startDate"));
		});

		it("should reject create without title", async () => {
			const result = await calendarImpl(
				{ action: "create", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("title"));
		});

		it("should reject update without eventId", async () => {
			const result = await calendarImpl({ action: "update" }, { config: createMockConfig() });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("eventId"));
		});

		it("should reject delete without eventId", async () => {
			const result = await calendarImpl({ action: "delete" }, { config: createMockConfig() });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("eventId"));
		});

		it("should reject availability without startDate", async () => {
			const result = await calendarImpl(
				{ action: "availability", duration: 30 },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("startDate"));
		});

		it("should reject availability without duration", async () => {
			const result = await calendarImpl(
				{ action: "availability", startDate: "2025-01-01T00:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("duration"));
		});

		it("should reject summary without startDate", async () => {
			const result = await calendarImpl({ action: "summary" }, { config: createMockConfig() });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("startDate"));
		});
	});
});

// --- Config Tests ---

import { loadConfig } from "../../../src/config/loader.js";
import { ConfigSchema } from "../../../src/config/config.js";

describe("Calendar Config", () => {
	it("should load config with calendar defaults", () => {
		const config = loadConfig();
		assert.ok(config.calendar);
		assert.strictEqual(config.calendar.active, "google");
	});

	it("should have calendar in config schema", () => {
		const defaults = ConfigSchema.parse({});
		const result = ConfigSchema.safeParse(defaults);
		assert.strictEqual(result.success, true);
		assert.ok(result.data.calendar);
	});
});
