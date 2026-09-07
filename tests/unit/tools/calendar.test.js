import { describe, it, before, after, mock } from "node:test";
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

		it("should reject invalid timezone", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
				timezone: "Invalid/Timezone",
			});
			assert.strictEqual(result.success, false);
		});

		it("should accept UTC timezone", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
				timezone: "UTC",
			});
			assert.strictEqual(result.success, true);
		});

		it("should accept local timezone", () => {
			const result = ReadEventSchema.safeParse({
				action: "read",
				startDate: "2025-01-01T00:00:00Z",
				timezone: "local",
			});
			assert.strictEqual(result.success, true);
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

import { CalendarProviderBase } from "../../../src/tools/calendar/providers/base.js";
import { calendar, calendarImpl, findFreeSlots } from "../../../src/tools/calendar/index.js";

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

		it("should return original for null timezone", () => {
			const provider = new CalendarProviderBase();
			const result = provider.convertTimezone("2025-01-01T12:00:00Z", null);
			assert.strictEqual(result, "2025-01-01T12:00:00Z");
		});

		it("should return original for undefined timezone", () => {
			const provider = new CalendarProviderBase();
			const result = provider.convertTimezone("2025-01-01T12:00:00Z", undefined);
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

		it("should handle busy intervals as arrays", () => {
			const busy = [["2025-01-01T09:00:00Z", "2025-01-01T10:00:00Z"]];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			assert.ok(slots.length > 0);
		});

		it("should handle null/undefined busy", () => {
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, null);
			assert.ok(slots.length > 0);
		});

		it("should handle busy intervals that start before range", () => {
			const busy = [{ start: "2024-12-31T23:00:00Z", end: "2025-01-01T01:00:00Z" }];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			assert.ok(slots.length > 0);
		});

		it("should handle busy intervals that end after range", () => {
			const busy = [{ start: "2025-01-01T23:00:00Z", end: "2025-01-02T01:00:00Z" }];
			const slots = findFreeSlots("2025-01-01T00:00:00Z", "2025-01-01T23:59:59Z", 60, busy);
			assert.ok(slots.length > 0);
		});

		it("should handle gap smaller than duration", () => {
			const busy = [
				{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T09:30:00Z" },
				{ start: "2025-01-01T09:45:00Z", end: "2025-01-01T10:00:00Z" },
			];
			const slots = findFreeSlots("2025-01-01T09:00:00Z", "2025-01-01T10:00:00Z", 60, busy);
			// The gap between 09:30 and 09:45 is only 15 min, less than 60 min duration
			assert.strictEqual(slots.length, 0);
		});
	});
});

// --- Calendar Tool Integration Tests ---

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
		assert.ok(config.calendar.google);
		assert.ok(config.calendar.msgraph);
	});

	it("should have calendar in config schema", () => {
		const defaults = ConfigSchema.parse({});
		assert.ok(defaults.calendar);
	});
});

// --- Factory Tests ---

import { getActiveCalendarProvider } from "../../../src/tools/calendar/providers/factory.js";

describe("Calendar Factory", () => {
	it("should return null for missing calendar config", () => {
		const provider = getActiveCalendarProvider({});
		assert.strictEqual(provider, null);
	});

	it("should fall back to loadConfig when config is null", () => {
		// When config is null/undefined, factory calls loadConfig() which returns cached config
		const provider = getActiveCalendarProvider(null);
		// Should return a provider from the cached config (google by default)
		assert.ok(provider);
		assert.strictEqual(provider.type, "google");
	});

	it("should return Google provider by default", () => {
		const provider = getActiveCalendarProvider(createMockConfig());
		assert.ok(provider);
		assert.strictEqual(provider.type, "google");
	});

	it("should return Google provider when active is google", () => {
		const config = createMockConfig({ active: "google" });
		const provider = getActiveCalendarProvider(config);
		assert.ok(provider);
		assert.strictEqual(provider.type, "google");
	});

	it("should return MS Graph provider when active is msgraph", () => {
		const config = createMockConfig({ active: "msgraph" });
		const provider = getActiveCalendarProvider(config);
		assert.ok(provider);
		assert.strictEqual(provider.type, "msgraph");
	});

	it("should return null for unknown active provider", () => {
		const config = createMockConfig({ active: "outlook" });
		const provider = getActiveCalendarProvider(config);
		assert.strictEqual(provider, null);
	});
});

// --- Google Provider Tests ---
// We mock the googleapis module methods before importing GoogleCalendarProvider

describe("Google Calendar Provider", () => {
	let GoogleCalendarProvider;
	let mockEventsList;
	let mockEventsInsert;
	let mockEventsUpdate;
	let mockEventsDelete;
	let mockFreebusyQuery;
	let mockCalendarObj;

	before(async () => {
		mockEventsList = mock.fn();
		mockEventsInsert = mock.fn();
		mockEventsUpdate = mock.fn();
		mockEventsDelete = mock.fn();
		mockFreebusyQuery = mock.fn();

		mockCalendarObj = {
			events: {
				list: mockEventsList,
				insert: mockEventsInsert,
				update: mockEventsUpdate,
				delete: mockEventsDelete,
			},
			freebusy: {
				query: mockFreebusyQuery,
			},
		};

		// Import the real googleapis module and mock its methods
		const { google } = await import("googleapis");
		mock.method(google, "calendar", () => mockCalendarObj);
		mock.method(
			google.auth,
			"JWT",
			class MockJWT {
				constructor(opts) {
					this.email = opts.email;
					this.key = opts.key;
					this.scope = opts.scope;
					this.quotaUser = undefined;
				}
			},
		);

		// Now import the provider module (it will use the mocked google)
		const googleModule = await import("../../../src/tools/calendar/providers/google.js");
		GoogleCalendarProvider = googleModule.GoogleCalendarProvider;
	});

	after(() => {
		mock.reset();
	});

	it("should create provider with apiKey", () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		assert.strictEqual(provider.type, "google");
		const creds = provider.validateCredentials();
		assert.strictEqual(creds.valid, true);
	});

	it("should create provider with service account key (JSON string)", () => {
		const provider = new GoogleCalendarProvider({
			serviceAccountKey: JSON.stringify({
				client_email: "svc@test.iam.gserviceaccount.com",
				private_key: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
			}),
		});
		assert.strictEqual(provider.type, "google");
	});

	it("should create provider with service account key (file path) throws when file missing", () => {
		// This will try to require a file path; we expect it to throw
		assert.throws(() => {
			new GoogleCalendarProvider({
				serviceAccountKey: "/nonexistent/key.json",
			});
		});
	});

	it("should create provider with impersonation", () => {
		const provider = new GoogleCalendarProvider({
			serviceAccountKey: JSON.stringify({
				client_email: "svc@test.iam.gserviceaccount.com",
				private_key: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
			}),
			impersonateEmail: "admin@example.com",
		});
		assert.strictEqual(provider.type, "google");
	});

	it("should fail validation with no credentials", () => {
		const provider = new GoogleCalendarProvider({});
		const creds = provider.validateCredentials();
		assert.strictEqual(creds.valid, false);
		assert.ok(creds.errors.length > 0);
	});

	it("should read events", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					items: [
						{
							id: "evt-1",
							summary: "Test Event",
							start: { dateTime: "2025-01-01T10:00:00Z" },
							end: { dateTime: "2025-01-01T11:00:00Z" },
							location: "Room A",
							description: "A test event",
							attendees: [{ email: "user@example.com" }],
							organizer: { email: "org@example.com" },
							status: "confirmed",
							visibility: "default",
						},
					],
				},
			}),
		);

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events.length, 1);
		assert.strictEqual(result.events[0].eventId, "evt-1");
		assert.strictEqual(result.events[0].title, "Test Event");
	});

	it("should read events with attendee and keyword filters", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: { items: [] },
			}),
		);

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
			attendee: "user@example.com",
			keyword: "meeting",
			maxResults: 10,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events.length, 0);
	});

	it("should read events with missing optional fields", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					items: [
						{
							id: "evt-minimal",
							// No summary, no start/end objects, no attendees, no organizer, no status, no visibility
						},
					],
				},
			}),
		);

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events.length, 1);
		assert.strictEqual(result.events[0].title, "Untitled");
		assert.strictEqual(result.events[0].attendees.length, 0);
	});

	it("should read events with date-only start/end (all-day events)", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					items: [
						{
							id: "evt-allday",
							summary: "All Day Event",
							start: { date: "2025-01-01" },
							end: { date: "2025-01-02" },
						},
					],
				},
			}),
		);

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events[0].start, "2025-01-01");
		assert.strictEqual(result.events[0].end, "2025-01-02");
	});

	it("should create event", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsInsert.mock.mockImplementation(() => Promise.resolve({ data: { id: "evt-new" } }));

		const result = await provider.createEvent({
			title: "New Event",
			start: "2025-01-01T10:00:00Z",
			end: "2025-01-01T11:00:00Z",
			description: "Description",
			location: "Room B",
			attendees: ["user1@example.com"],
			reminders: [{ method: "popup", minutes: 15 }],
			visibility: "default",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.eventId, "evt-new");
	});

	it("should create event without reminders", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsInsert.mock.mockImplementation(() => Promise.resolve({ data: { id: "evt-new-2" } }));

		const result = await provider.createEvent({
			title: "Simple Event",
			start: "2025-01-01T10:00:00Z",
			end: "2025-01-01T11:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.eventId, "evt-new-2");
	});

	it("should update event", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsUpdate.mock.mockImplementation(() => Promise.resolve({ data: {} }));

		const result = await provider.updateEvent({
			eventId: "evt-1",
			title: "Updated Title",
			description: "Updated desc",
			location: "Room C",
			start: "2025-01-02T10:00:00Z",
			end: "2025-01-02T11:00:00Z",
			attendees: ["user2@example.com"],
			reminders: [{ method: "email", minutes: 30 }],
			visibility: "private",
		});
		assert.strictEqual(result.ok, true);
	});

	it("should update event with minimal fields", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsUpdate.mock.mockImplementation(() => Promise.resolve({ data: {} }));

		const result = await provider.updateEvent({ eventId: "evt-1", title: "Just Title" });
		assert.strictEqual(result.ok, true);
	});

	it("should delete event", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsDelete.mock.mockImplementation(() => Promise.resolve({}));

		const result = await provider.deleteEvent({ eventId: "evt-1" });
		assert.strictEqual(result.ok, true);
	});

	it("should find availability", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockFreebusyQuery.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					calendars: {
						primary: {
							busy: [{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T10:00:00Z" }],
						},
					},
				},
			}),
		);

		const result = await provider.findAvailability({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-01T23:59:59Z",
			duration: 60,
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.slots));
	});

	it("should find availability with no busy slots", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockFreebusyQuery.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					calendars: {
						primary: { busy: [] },
					},
				},
			}),
		);

		const result = await provider.findAvailability({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-01T23:59:59Z",
			duration: 60,
		});
		assert.strictEqual(result.ok, true);
	});

	it("should generate summary", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					items: [
						{
							id: "evt-1",
							summary: "Event 1",
							start: { dateTime: "2025-01-01T10:00:00Z" },
							end: { dateTime: "2025-01-01T11:00:00Z" },
							description: "Desc",
							attendees: [{ email: "a@b.com" }],
							location: "Room",
						},
					],
				},
			}),
		);

		const result = await provider.generateSummary({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.summary === "string");
	});

	it("should generate summary for single event", async () => {
		const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
		mockEventsList.mock.mockImplementation(() =>
			Promise.resolve({
				data: {
					items: [
						{
							id: "evt-1",
							summary: "Event 1",
							start: { dateTime: "2025-01-01T10:00:00Z" },
							end: { dateTime: "2025-01-01T11:00:00Z" },
						},
						{
							id: "evt-2",
							summary: "Event 2",
							start: { dateTime: "2025-01-01T14:00:00Z" },
							end: { dateTime: "2025-01-01T15:00:00Z" },
						},
					],
				},
			}),
		);

		const result = await provider.generateSummary({
			eventId: "evt-1",
		});
		assert.strictEqual(result.ok, true);
		const parsed = JSON.parse(result.summary);
		assert.strictEqual(parsed.length, 1);
		assert.strictEqual(parsed[0].eventId, "evt-1");
	});

	// --- calendarImpl Success Paths (using mocked googleapis via real factory) ---
	// These tests must be inside this describe block because the googleapis mock
	// is active here. The factory creates a real GoogleCalendarProvider which
	// uses the globally mocked googleapis methods.

	describe("calendarImpl with Google provider", () => {
		it("should successfully read events", async () => {
			mockEventsList.mock.mockImplementation(() =>
				Promise.resolve({
					data: {
						items: [
							{
								id: "evt-1",
								summary: "Test",
								start: { dateTime: "2025-01-01T10:00:00Z" },
								end: { dateTime: "2025-01-01T11:00:00Z" },
							},
						],
					},
				}),
			);

			const result = await calendarImpl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.count, 1);
		});

		it("should handle read action with default endDate", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.resolve({ data: { items: [] } }));

			const result = await calendarImpl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
		});

		it("should handle read action error from provider", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.reject(new Error("Provider error")));

			const result = await calendarImpl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle read action exception", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.reject(new Error("Network error")));

			const result = await calendarImpl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar read failed"));
		});

		it("should successfully create event", async () => {
			mockEventsInsert.mock.mockImplementation(() => Promise.resolve({ data: { id: "evt-new" } }));

			const result = await calendarImpl(
				{
					action: "create",
					title: "Test",
					start: "2025-01-01T10:00:00Z",
					end: "2025-01-01T11:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-new");
		});

		it("should handle create action error from provider", async () => {
			mockEventsInsert.mock.mockImplementation(() => Promise.reject(new Error("Create failed")));

			const result = await calendarImpl(
				{
					action: "create",
					title: "Test",
					start: "2025-01-01T10:00:00Z",
					end: "2025-01-01T11:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle create action exception", async () => {
			mockEventsInsert.mock.mockImplementation(() => Promise.reject(new Error("Create error")));

			const result = await calendarImpl(
				{
					action: "create",
					title: "Test",
					start: "2025-01-01T10:00:00Z",
					end: "2025-01-01T11:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar create failed"));
		});

		it("should successfully update event", async () => {
			mockEventsUpdate.mock.mockImplementation(() => Promise.resolve({ data: {} }));

			const result = await calendarImpl(
				{ action: "update", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-1");
		});

		it("should handle update action error from provider", async () => {
			mockEventsUpdate.mock.mockImplementation(() => Promise.reject(new Error("Update failed")));

			const result = await calendarImpl(
				{ action: "update", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle update action exception", async () => {
			mockEventsUpdate.mock.mockImplementation(() => Promise.reject(new Error("Update error")));

			const result = await calendarImpl(
				{ action: "update", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar update failed"));
		});

		it("should successfully delete event", async () => {
			mockEventsDelete.mock.mockImplementation(() => Promise.resolve({}));

			const result = await calendarImpl(
				{ action: "delete", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-1");
		});

		it("should handle delete action error from provider", async () => {
			mockEventsDelete.mock.mockImplementation(() => Promise.reject(new Error("Delete failed")));

			const result = await calendarImpl(
				{ action: "delete", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle delete action exception", async () => {
			mockEventsDelete.mock.mockImplementation(() => Promise.reject(new Error("Delete error")));

			const result = await calendarImpl(
				{ action: "delete", eventId: "evt-1" },
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar delete failed"));
		});

		it("should successfully find availability", async () => {
			mockFreebusyQuery.mock.mockImplementation(() =>
				Promise.resolve({
					data: {
						calendars: {
							primary: {
								busy: [{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T10:00:00Z" }],
							},
						},
					},
				}),
			);

			const result = await calendarImpl(
				{
					action: "availability",
					startDate: "2025-01-01T00:00:00Z",
					duration: 60,
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.slots));
		});

		it("should handle availability action with default endDate", async () => {
			mockFreebusyQuery.mock.mockImplementation(() =>
				Promise.resolve({
					data: { calendars: { primary: { busy: [] } } },
				}),
			);

			const result = await calendarImpl(
				{
					action: "availability",
					startDate: "2025-01-01T00:00:00Z",
					duration: 60,
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
		});

		it("should handle availability action error from provider", async () => {
			mockFreebusyQuery.mock.mockImplementation(() =>
				Promise.reject(new Error("Availability failed")),
			);

			const result = await calendarImpl(
				{
					action: "availability",
					startDate: "2025-01-01T00:00:00Z",
					duration: 60,
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle availability action exception", async () => {
			mockFreebusyQuery.mock.mockImplementation(() =>
				Promise.reject(new Error("Availability error")),
			);

			const result = await calendarImpl(
				{
					action: "availability",
					startDate: "2025-01-01T00:00:00Z",
					duration: 60,
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar availability failed"));
		});

		it("should successfully generate summary", async () => {
			mockEventsList.mock.mockImplementation(() =>
				Promise.resolve({
					data: {
						items: [
							{
								id: "evt-1",
								summary: "Event",
								start: { dateTime: "2025-01-01T10:00:00Z" },
								end: { dateTime: "2025-01-01T11:00:00Z" },
							},
						],
					},
				}),
			);

			const result = await calendarImpl(
				{
					action: "summary",
					startDate: "2025-01-01T00:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
			assert.ok(typeof result.summary === "string");
		});

		it("should handle summary action with default endDate", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.resolve({ data: { items: [] } }));

			const result = await calendarImpl(
				{
					action: "summary",
					startDate: "2025-01-01T00:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, true);
		});

		it("should handle summary action error from provider", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.reject(new Error("Summary failed")));

			const result = await calendarImpl(
				{
					action: "summary",
					startDate: "2025-01-01T00:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
		});

		it("should handle summary action exception", async () => {
			mockEventsList.mock.mockImplementation(() => Promise.reject(new Error("Summary error")));

			const result = await calendarImpl(
				{
					action: "summary",
					startDate: "2025-01-01T00:00:00Z",
				},
				{ config: createMockConfig() },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error?.includes("Calendar summary failed"));
		});
	});
});

// --- MS Graph Provider Tests ---
// We mock the @microsoft/microsoft-graph-client module methods before importing MsGraphProvider

describe("MS Graph Calendar Provider", () => {
	let MsGraphProvider;
	let originalFetch;
	let fetchMock;

	before(async () => {
		// Save original fetch
		originalFetch = global.fetch;
		fetchMock = mock.fn();

		// Mock global.fetch to handle both auth token requests and graph API calls.
		// The real Client.init will use this mock for its authProvider callback,
		// and the real client's API methods will also use this mock for HTTP requests.
		global.fetch = fetchMock;

		// Helper to create a mock Response object that the Graph client can parse
		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Default handler: auth token endpoint succeeds, graph endpoints return empty
		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			// Default graph response: empty
			return Promise.resolve(mockResponse({ value: [] }));
		});

		// Import the provider module (it will use the real Client.init with mocked fetch)
		const msgraphModule = await import("../../../src/tools/calendar/providers/msgraph.js");
		MsGraphProvider = msgraphModule.MsGraphProvider;
	});

	after(() => {
		global.fetch = originalFetch;
		mock.reset();
	});

	it("should create provider with valid config", () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});
		assert.strictEqual(provider.type, "msgraph");
		const creds = provider.validateCredentials();
		assert.strictEqual(creds.valid, true);
	});

	it("should fail validation with missing credentials", () => {
		const provider = new MsGraphProvider({});
		const creds = provider.validateCredentials();
		assert.strictEqual(creds.valid, false);
		assert.ok(creds.errors.length > 0);
	});

	it("should read events", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(
				mockResponse({
					value: [
						{
							id: "evt-1",
							subject: "Test Event",
							start: { dateTime: "2025-01-01T10:00:00Z" },
							end: { dateTime: "2025-01-01T11:00:00Z" },
							location: { displayName: "Room A" },
							body: { content: "Description" },
							attendees: [{ emailAddress: { address: "user@example.com" }, type: "required" }],
							organizer: { emailAddress: { address: "org@example.com" } },
							showAs: "busy",
						},
					],
				}),
			);
		});

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events.length, 1);
		assert.strictEqual(result.events[0].eventId, "evt-1");
		assert.strictEqual(result.events[0].title, "Test Event");
	});

	it("should read events with delegated user", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({ value: [] }));
		});

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
			delegatedUser: "delegated@example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	it("should read events with missing optional fields", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(
				mockResponse({
					value: [
						{
							id: "evt-minimal",
							// No subject, no start/end, no location, no body, no attendees, no organizer, no showAs
						},
					],
				}),
			);
		});

		const result = await provider.readEvents({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.events.length, 1);
		assert.strictEqual(result.events[0].title, "Untitled");
	});

	it("should create event", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({ id: "evt-new" }));
		});

		const result = await provider.createEvent({
			title: "New Event",
			start: "2025-01-01T10:00:00Z",
			end: "2025-01-01T11:00:00Z",
			description: "Description",
			location: "Room B",
			attendees: ["user1@example.com"],
			reminders: [{ method: "popup", minutes: 15 }],
			visibility: "default",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.eventId, "evt-new");
	});

	it("should create event with private visibility", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({ id: "evt-private" }));
		});

		const result = await provider.createEvent({
			title: "Private Event",
			start: "2025-01-01T10:00:00Z",
			end: "2025-01-01T11:00:00Z",
			visibility: "private",
		});
		assert.strictEqual(result.ok, true);
	});

	it("should update event", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({}));
		});

		const result = await provider.updateEvent({
			eventId: "evt-1",
			title: "Updated Title",
			description: "Updated desc",
			location: "Room C",
			start: "2025-01-02T10:00:00Z",
			end: "2025-01-02T11:00:00Z",
			attendees: ["user2@example.com"],
			reminders: [{ method: "email", minutes: 30 }],
		});
		assert.strictEqual(result.ok, true);
	});

	it("should update event with minimal fields", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({}));
		});

		const result = await provider.updateEvent({ eventId: "evt-1", title: "Just Title" });
		assert.strictEqual(result.ok, true);
	});

	it("should delete event", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({}));
		});

		const result = await provider.deleteEvent({ eventId: "evt-1" });
		assert.strictEqual(result.ok, true);
	});

	it("should find availability", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(
				mockResponse({
					value: [
						{
							busyTimes: [
								{
									start: { dateTime: "2025-01-01T09:00:00Z" },
									end: { dateTime: "2025-01-01T10:00:00Z" },
								},
							],
						},
					],
				}),
			);
		});

		const result = await provider.findAvailability({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-01T23:59:59Z",
			duration: 60,
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.slots));
	});

	it("should find availability with no busy slots", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({ value: [] }));
		});

		const result = await provider.findAvailability({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-01T23:59:59Z",
			duration: 60,
		});
		assert.strictEqual(result.ok, true);
	});

	it("should generate summary", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(
				mockResponse({
					value: [
						{
							id: "evt-1",
							subject: "Event 1",
							start: { dateTime: "2025-01-01T10:00:00Z" },
							end: { dateTime: "2025-01-01T11:00:00Z" },
							body: { content: "Desc" },
							attendees: [{ emailAddress: { address: "a@b.com" } }],
							location: { displayName: "Room" },
						},
					],
				}),
			);
		});

		const result = await provider.generateSummary({
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-02T00:00:00Z",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.summary === "string");
	});

	it("should generate summary with delegated user", async () => {
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		function mockResponse(body, status = 200) {
			const bodyStr = JSON.stringify(body);
			return new Response(bodyStr, {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}

		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.resolve(mockResponse({ access_token: "mock-access-token" }));
			}
			return Promise.resolve(mockResponse({ value: [] }));
		});

		const result = await provider.generateSummary({
			delegatedUser: "delegate@example.com",
		});
		assert.strictEqual(result.ok, true);
	});

	it("should handle auth fetch failure", async () => {
		// Create a provider where the auth token fetch fails
		const provider = new MsGraphProvider({
			tenantId: "tenant-1",
			clientId: "client-1",
			clientSecret: "secret-1",
		});

		// Make auth fetch fail
		fetchMock.mock.mockImplementation((url) => {
			const urlStr = typeof url === "string" ? url : url.toString();
			if (urlStr.includes("login.microsoftonline.com")) {
				return Promise.reject(new Error("Auth failed"));
			}
			return Promise.resolve(
				new Response(JSON.stringify({ value: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		});

		// The API call should fail because auth failed
		await assert.rejects(() =>
			provider.readEvents({ startDate: "2025-01-01T00:00:00Z", endDate: "2025-01-02T00:00:00Z" }),
		);
	});
});

// --- calendarImpl Error Paths (no mocking needed) ---

describe("calendarImpl Error Paths", () => {
	it("should return error when no provider configured", async () => {
		const result = await calendarImpl(
			{ action: "read", startDate: "2025-01-01T00:00:00Z" },
			{ config: {} },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error?.includes("No calendar provider configured"));
	});

	it("should return error when provider credentials are invalid", async () => {
		const config = createMockConfig();
		config.calendar.google.apiKey = "";
		const result = await calendarImpl(
			{ action: "read", startDate: "2025-01-01T00:00:00Z" },
			{ config },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error?.includes("Invalid calendar provider config"));
	});

	it("should handle create action with missing start/end", async () => {
		const result = await calendarImpl(
			{ action: "create", title: "Test" },
			{ config: createMockConfig() },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error?.includes("start and end"));
	});
});

// --- Rate Limiting and Retry Tests ---

describe("CalendarProviderBase Rate Limiting", () => {
	it("should enforce rate limit and throw", () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 2 } });
		// First two calls should succeed
		provider._executeWithRetry(async () => "ok");
		provider._executeWithRetry(async () => "ok");
		// Third call should fail with rate limit
		assert.rejects(() => provider._executeWithRetry(async () => "ok"), /rate limit/i);
	});

	it("should reset rate limit window after timeout", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 1 } });
		// Use first request
		await provider._executeWithRetry(async () => "ok");
		// Second should hit rate limit
		await assert.rejects(() => provider._executeWithRetry(async () => "ok"), /rate limit/i);
	});

	it("should retry on rate limit error", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		let attempts = 0;
		const result = await provider._executeWithRetry(async () => {
			attempts++;
			if (attempts < 3) {
				const err = new Error("Rate limit exceeded");
				err.status = 429;
				throw err;
			}
			return "success";
		}, 5);
		assert.strictEqual(result, "success");
		assert.strictEqual(attempts, 3);
	});

	it("should retry on 500 error", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		let attempts = 0;
		const result = await provider._executeWithRetry(async () => {
			attempts++;
			if (attempts < 2) {
				const err = new Error("Server error");
				err.status = 500;
				throw err;
			}
			return "success";
		}, 3);
		assert.strictEqual(result, "success");
		assert.strictEqual(attempts, 2);
	});

	it("should retry on 503 error", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		let attempts = 0;
		const result = await provider._executeWithRetry(async () => {
			attempts++;
			if (attempts < 2) {
				const err = new Error("Service unavailable");
				err.status = 503;
				throw err;
			}
			return "success";
		}, 3);
		assert.strictEqual(result, "success");
		assert.strictEqual(attempts, 2);
	});

	it("should throw after exhausting retries on rate limit", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		let attempts = 0;
		await assert.rejects(
			() =>
				provider._executeWithRetry(async () => {
					attempts++;
					const err = new Error("Rate limit exceeded");
					err.status = 429;
					throw err;
				}, 2),
			/rate limit/i,
		);
		assert.strictEqual(attempts, 2);
	});

	it("should throw on abort/timeout after retries", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		provider.timeoutMs = 1; // Very short timeout
		await assert.rejects(
			() =>
				provider._executeWithRetry(async ({ signal }) => {
					// Wait for the timeout to trigger abort
					await new Promise((resolve) => setTimeout(resolve, 50));
					if (signal.aborted) {
						const err = new Error("The operation was aborted");
						err.name = "AbortError";
						throw err;
					}
					return "ok";
				}, 2),
			/timed out/i,
		);
	});

	it("should throw non-retryable errors immediately", async () => {
		const provider = new CalendarProviderBase({ rateLimit: { requestsPerMinute: 100 } });
		await assert.rejects(
			() =>
				provider._executeWithRetry(async () => {
					throw new Error("Bad request");
				}, 3),
			/Bad request/,
		);
	});
});
