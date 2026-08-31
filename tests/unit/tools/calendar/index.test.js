/**
 * Tests for the calendar tool orchestrator.
 * @see {@link src/tools/calendar/index.js}
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { calendarImpl, calendar, findFreeSlots } from "../../../../src/tools/calendar/index.js";
import { CalendarProviderBase } from "../../../../src/tools/calendar/providers/base.js";

// --- Helpers ---

/**
 * Create a mock provider that returns a valid credential check and stubbed methods.
 * @param {object} [overrides] - Method overrides
 * @returns {CalendarProviderBase}
 */
function createMockProvider(overrides = {}) {
	const provider = new (class extends CalendarProviderBase {
		type = "test";
		async readEvents(_params) {
			return overrides.readEvents || { ok: true, events: [] };
		}
		async createEvent(_params) {
			return overrides.createEvent || { ok: true, eventId: "evt-123" };
		}
		async updateEvent(_params) {
			return overrides.updateEvent || { ok: true };
		}
		async deleteEvent(_params) {
			return overrides.deleteEvent || { ok: true };
		}
		async findAvailability(_params) {
			return overrides.findAvailability || { ok: true, slots: [] };
		}
		async generateSummary(_params) {
			return overrides.generateSummary || { ok: true, summary: "No meetings" };
		}
	})();
	return provider;
}

/**
 * Wrap calendarImpl with a mocked factory.
 * @param {CalendarProviderBase} mockProvider
 * @returns {Function}
 */
function withMockProvider(mockProvider) {
	mock.module("../../../../src/tools/calendar/providers/factory.js", {
		getActiveCalendarProvider: () => mockProvider,
	});
	// Re-import to pick up the mock
	return async (input, options) => {
		const { calendarImpl: impl } = await import("../../../../../src/tools/calendar/index.js");
		return impl(input, options);
	};
}

describe("calendarImpl", () => {
	describe("action validation", () => {
		it("should reject unknown action", async () => {
			const result = await calendarImpl({ action: "unknown" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Unknown action"));
			assert.ok(result.error.includes("read"));
		});

		it("should accept read action", async () => {
			const provider = createMockProvider({
				readEvents: () => ({ ok: true, events: [] }),
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "read", startDate: "2025-01-01T00:00:00Z" }, {});
			assert.strictEqual(result.ok, true);
		});

		it("should accept create action", async () => {
			const provider = createMockProvider({
				createEvent: () => ({ ok: true, eventId: "evt-1" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "create", title: "Meeting", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, true);
		});

		it("should accept update action", async () => {
			const provider = createMockProvider({
				updateEvent: () => ({ ok: true }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "update", eventId: "evt-1", title: "Updated" },
				{},
			);
			assert.strictEqual(result.ok, true);
		});

		it("should accept delete action", async () => {
			const provider = createMockProvider({
				deleteEvent: () => ({ ok: true }),
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "delete", eventId: "evt-1" }, {});
			assert.strictEqual(result.ok, true);
		});

		it("should accept availability action", async () => {
			const provider = createMockProvider({
				findAvailability: () => ({ ok: true, slots: [] }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z", duration: 60 },
				{},
			);
			assert.strictEqual(result.ok, true);
		});

		it("should accept summary action", async () => {
			const provider = createMockProvider({
				generateSummary: () => ({ ok: true, summary: "Summary" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "summary", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, true);
		});
	});

	describe("read action", () => {
		it("should require startDate", async () => {
			const result = await calendarImpl({ action: "read" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("startDate is required"));
		});

		it("should use default endDate (7 days from now) when not provided", async () => {
			const provider = createMockProvider({
				readEvents: (params) => {
					assert.ok(params.endDate);
					return { ok: true, events: [] };
				},
			});
			const impl = withMockProvider(provider);
			await impl({ action: "read", startDate: "2025-01-01T00:00:00Z" }, {});
		});

		it("should use provided endDate", async () => {
			const provider = createMockProvider({
				readEvents: (params) => {
					assert.strictEqual(params.endDate, "2025-01-02T00:00:00Z");
					return { ok: true, events: [] };
				},
			});
			const impl = withMockProvider(provider);
			await impl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z", endDate: "2025-01-02T00:00:00Z" },
				{},
			);
		});

		it("should return events on success", async () => {
			const events = [{ id: "e1", title: "Meeting 1" }];
			const provider = createMockProvider({
				readEvents: () => ({ ok: true, events }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.count, 1);
			assert.deepStrictEqual(result.events, events);
		});

		it("should return error when provider readEvents fails", async () => {
			const provider = createMockProvider({
				readEvents: () => ({ ok: false, error: "API error" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "API error");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				readEvents: () => {
					throw new Error("Network failure");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "read", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar read failed"));
			assert.ok(result.error.includes("Network failure"));
		});
	});

	describe("create action", () => {
		it("should require title", async () => {
			const result = await calendarImpl(
				{ action: "create", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("title is required"));
		});

		it("should require start and end", async () => {
			const result = await calendarImpl(
				{ action: "create", title: "Meeting" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("start and end times are required"));
		});

		it("should return eventId on success", async () => {
			const provider = createMockProvider({
				createEvent: () => ({ ok: true, eventId: "evt-456" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "create", title: "Meeting", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-456");
		});

		it("should return error when provider createEvent fails", async () => {
			const provider = createMockProvider({
				createEvent: () => ({ ok: false, error: "Conflict" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "create", title: "Meeting", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "Conflict");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				createEvent: () => {
					throw new Error("Timeout");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "create", title: "Meeting", start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar create failed"));
		});
	});

	describe("update action", () => {
		it("should require eventId", async () => {
			const result = await calendarImpl({ action: "update", title: "New Title" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("eventId is required"));
		});

		it("should return eventId on success", async () => {
			const provider = createMockProvider({
				updateEvent: () => ({ ok: true }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "update", eventId: "evt-1", title: "Updated" },
				{},
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-1");
		});

		it("should return error when provider updateEvent fails", async () => {
			const provider = createMockProvider({
				updateEvent: () => ({ ok: false, error: "Not found" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "update", eventId: "evt-1" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "Not found");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				updateEvent: () => {
					throw new Error("DB error");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "update", eventId: "evt-1" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar update failed"));
		});
	});

	describe("delete action", () => {
		it("should require eventId", async () => {
			const result = await calendarImpl({ action: "delete" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("eventId is required"));
		});

		it("should return eventId on success", async () => {
			const provider = createMockProvider({
				deleteEvent: () => ({ ok: true }),
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "delete", eventId: "evt-1" }, {});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "evt-1");
		});

		it("should return error when provider deleteEvent fails", async () => {
			const provider = createMockProvider({
				deleteEvent: () => ({ ok: false, error: "Not found" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "delete", eventId: "evt-1" }, {});
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "Not found");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				deleteEvent: () => {
					throw new Error("Network error");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "delete", eventId: "evt-1" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar delete failed"));
		});
	});

	describe("availability action", () => {
		it("should require startDate and duration", async () => {
			const result = await calendarImpl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("startDate and duration"));
		});

		it("should use default endDate when not provided", async () => {
			const provider = createMockProvider({
				findAvailability: (params) => {
					assert.ok(params.endDate);
					return { ok: true, slots: [] };
				},
			});
			const impl = withMockProvider(provider);
			await impl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z", duration: 60 },
				{},
			);
		});

		it("should return slots on success", async () => {
			const slots = [{ start: "2025-01-01T09:00:00Z", end: "2025-01-01T10:00:00Z" }];
			const provider = createMockProvider({
				findAvailability: () => ({ ok: true, slots }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z", duration: 60 },
				{},
			);
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.slots, slots);
		});

		it("should return error when provider findAvailability fails", async () => {
			const provider = createMockProvider({
				findAvailability: () => ({ ok: false, error: "No slots" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z", duration: 60 },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "No slots");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				findAvailability: () => {
					throw new Error("API down");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "availability", startDate: "2025-01-01T09:00:00Z", duration: 60 },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar availability failed"));
		});
	});

	describe("summary action", () => {
		it("should require startDate", async () => {
			const result = await calendarImpl({ action: "summary" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("startDate is required"));
		});

		it("should use default endDate when not provided", async () => {
			const provider = createMockProvider({
				generateSummary: (params) => {
					assert.ok(params.endDate);
					return { ok: true, summary: "Summary" };
				},
			});
			const impl = withMockProvider(provider);
			await impl({ action: "summary", startDate: "2025-01-01T00:00:00Z" }, {});
		});

		it("should return summary on success", async () => {
			const provider = createMockProvider({
				generateSummary: () => ({ ok: true, summary: "You have 3 meetings today" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "summary", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.summary, "You have 3 meetings today");
		});

		it("should return error when provider generateSummary fails", async () => {
			const provider = createMockProvider({
				generateSummary: () => ({ ok: false, error: "Provider error" }),
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "summary", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "Provider error");
		});

		it("should catch and wrap provider errors", async () => {
			const provider = createMockProvider({
				generateSummary: () => {
					throw new Error("Timeout");
				},
			});
			const impl = withMockProvider(provider);
			const result = await impl(
				{ action: "summary", startDate: "2025-01-01T00:00:00Z" },
				{},
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Calendar summary failed"));
		});
	});

	describe("provider configuration", () => {
		it("should return error when no provider is configured", async () => {
			const impl = withMockProvider(null);
			const result = await impl({ action: "read", startDate: "2025-01-01T00:00:00Z" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("No calendar provider configured"));
		});

		it("should return error when validateCredentials fails", async () => {
			const provider = createMockProvider();
			provider.validateCredentials = () => ({
				valid: false,
				errors: ["Missing API key", "Invalid token"],
			});
			const impl = withMockProvider(provider);
			const result = await impl({ action: "read", startDate: "2025-01-01T00:00:00Z" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Invalid calendar provider config"));
			assert.ok(result.error.includes("Missing API key"));
		});
	});

	describe("default case", () => {
		it("should return error for unknown action (default branch)", async () => {
			const result = await calendarImpl({ action: "foobar" }, {});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Unknown action"));
		});
	});
});

describe("calendar tool", () => {
	it("should have correct name", () => {
		assert.strictEqual(calendar.name, "calendar");
	});

	it("should have a description", () => {
		assert.ok(calendar.description.length > 0);
		assert.ok(calendar.description.includes("read events"));
	});

	it("should have a schema", () => {
		assert.ok(calendar.schema);
	});
});

describe("findFreeSlots re-export", () => {
	it("should be a function", () => {
		assert.strictEqual(typeof findFreeSlots, "function");
	});

	it("should call the base class static method", () => {
		const slots = CalendarProviderBase.findFreeSlots(
			"2025-01-01T00:00:00Z",
			"2025-01-01T23:59:59Z",
			60,
			[],
		);
		assert.ok(Array.isArray(slots));
	});
});
