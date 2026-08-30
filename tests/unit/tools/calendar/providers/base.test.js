/**
 * Tests for the calendar provider base class.
 * @see {@link src/tools/calendar/providers/base.js}
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CalendarProviderBase } from "../../../../../src/tools/calendar/providers/base.js";

describe("CalendarProviderBase", () => {
	describe("constructor", () => {
		it("should set default rate limit when no config provided", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.rateLimit, 60);
		});

		it("should set default timeout when no config provided", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.timeoutMs, 10000);
		});

		it("should set default type when no config provided", () => {
			const provider = new CalendarProviderBase();
			assert.strictEqual(provider.type, "base");
		});

		it("should override rate limit from config", () => {
			const provider = new CalendarProviderBase({
				rateLimit: { requestsPerMinute: 120 },
			});
			assert.strictEqual(provider.rateLimit, 120);
		});

		it("should ignore rate limit when config is undefined", () => {
			const provider = new CalendarProviderBase(undefined);
			assert.strictEqual(provider.rateLimit, 60);
		});

		it("should ignore rate limit when config is empty object", () => {
			const provider = new CalendarProviderBase({});
			assert.strictEqual(provider.rateLimit, 60);
		});
	});

	describe("validateCredentials", () => {
		it("should return valid credentials by default", () => {
			const provider = new CalendarProviderBase();
			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, true);
			assert.ok(!result.errors);
		});
	});

	describe("convertTimezone", () => {
		it("should return isoTime unchanged when timezone is UTC", () => {
			const provider = new CalendarProviderBase();
			const isoTime = "2025-01-01T12:00:00Z";
			const result = provider.convertTimezone(isoTime, "UTC");
			assert.strictEqual(result, isoTime);
		});

		it("should return isoTime unchanged when timezone is undefined", () => {
			const provider = new CalendarProviderBase();
			const isoTime = "2025-01-01T12:00:00Z";
			const result = provider.convertTimezone(isoTime, undefined);
			assert.strictEqual(result, isoTime);
		});

		it("should return isoTime unchanged when timezone is null", () => {
			const provider = new CalendarProviderBase();
			const isoTime = "2025-01-01T12:00:00Z";
			const result = provider.convertTimezone(isoTime, null);
			assert.strictEqual(result, isoTime);
		});

		it("should convert to a different timezone", () => {
			const provider = new CalendarProviderBase();
			const isoTime = "2025-01-01T12:00:00Z";
			const result = provider.convertTimezone(isoTime, "America/New_York");
			assert.ok(typeof result === "string");
			assert.ok(result.length > 0);
		});
	});

	describe("findFreeSlots (static)", () => {
		it("should return empty array when no busy intervals", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				[],
			);
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].duration, 60);
		});

		it("should return empty array when no busy intervals with null", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				null,
			);
			assert.strictEqual(result.length, 1);
		});

		it("should return empty array when no busy intervals with undefined", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				undefined,
			);
			assert.strictEqual(result.length, 1);
		});

		it("should find free slot before busy interval", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T12:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].duration, 60);
		});

		it("should find free slot after busy interval", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T12:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T09:00:00Z", "2025-01-01T10:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 1);
		});

		it("should find free slot between two busy intervals", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T13:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T09:00:00Z", "2025-01-01T10:00:00Z"],
				["2025-01-01T11:00:00Z", "2025-01-01T12:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 2);
		});

		it("should return empty array when no free slots available", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T09:00:00Z", "2025-01-01T10:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 0);
		});

		it("should return empty array when busy interval exceeds range", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T08:00:00Z", "2025-01-01T11:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 0);
		});

		it("should handle object-style busy intervals", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T12:00:00Z";
			const duration = 60;
			const busy = [
				{ start: "2025-01-01T10:00:00Z", end: "2025-01-01T11:00:00Z" },
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 2);
		});

		it("should skip busy intervals that start after range end", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T09:00:00Z", "2025-01-01T09:30:00Z"],
				["2025-01-01T11:00:00Z", "2025-01-01T12:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 1);
		});

		it("should return empty array when duration exceeds range", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T09:30:00Z";
			const duration = 60;
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				[],
			);
			assert.strictEqual(result.length, 0);
		});

		it("should handle overlapping busy intervals", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T12:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T09:00:00Z", "2025-01-01T10:30:00Z"],
				["2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 1);
		});

		it("should handle multiple free slots", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T15:00:00Z";
			const duration = 60;
			const busy = [
				["2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"],
				["2025-01-01T13:00:00Z", "2025-01-01T14:00:00Z"],
			];
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				busy,
			);
			assert.strictEqual(result.length, 3);
		});

		it("should return slots with correct ISO 8601 format", () => {
			const rangeStart = "2025-01-01T09:00:00Z";
			const rangeEnd = "2025-01-01T10:00:00Z";
			const duration = 60;
			const result = CalendarProviderBase.findFreeSlots(
				rangeStart,
				rangeEnd,
				duration,
				[],
			);
			assert.ok(result[0].start.endsWith("Z"));
			assert.ok(result[0].end.endsWith("Z"));
		});
	});

	describe("abstract methods", () => {
		it("should throw on readEvents", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.readEvents({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});

		it("should throw on createEvent", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.createEvent({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});

		it("should throw on updateEvent", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.updateEvent({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});

		it("should throw on deleteEvent", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.deleteEvent({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});

		it("should throw on findAvailability", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.findAvailability({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});

		it("should throw on generateSummary", async () => {
			const provider = new CalendarProviderBase();
			try {
				await provider.generateSummary({});
				assert.fail("Should have thrown");
			} catch (err) {
				assert.ok(err.message.includes("Not implemented"));
			}
		});
	});
});
