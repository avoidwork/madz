/**
 * Tests for the calendar provider factory.
 * @see {@link src/tools/calendar/providers/factory.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getActiveCalendarProvider } from "../../../../../src/tools/calendar/providers/factory.js";

describe("getActiveCalendarProvider", () => {
	describe("with google config", () => {
		it("should return GoogleCalendarProvider when active is 'google'", () => {
			const mockConfig = {
				calendar: {
					active: "google",
					google: {
						type: "google",
						apiKey: "test-key",
						rateLimit: { requestsPerMinute: 60 },
					},
				},
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.ok(provider);
			assert.strictEqual(provider.type, "google");
		});

		it("should default to google when active is undefined", () => {
			const mockConfig = {
				calendar: {
					google: {
						type: "google",
						apiKey: "test-key",
					},
				},
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.ok(provider);
			assert.strictEqual(provider.type, "google");
		});
	});

	describe("with msgraph config", () => {
		it("should return MsGraphProvider when active is 'msgraph'", () => {
			const mockConfig = {
				calendar: {
					active: "msgraph",
					msgraph: {
						type: "msgraph",
						tenantId: "test-tenant",
						clientId: "test-client",
						clientSecret: "test-secret",
						rateLimit: { requestsPerMinute: 60 },
					},
				},
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.ok(provider);
			assert.strictEqual(provider.type, "msgraph");
		});
	});

	describe("with no calendar config", () => {
		it("should return null when calendar config is missing", () => {
			const mockConfig = {
				other: "config",
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.strictEqual(provider, null);
		});

		it("should return null when calendar config is undefined", () => {
			const mockConfig = {
				calendar: undefined,
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.strictEqual(provider, null);
		});
	});

	describe("with unknown provider type", () => {
		it("should return null for unknown provider type", () => {
			const mockConfig = {
				calendar: {
					active: "unknown",
				},
			};

			const provider = getActiveCalendarProvider(mockConfig);
			assert.strictEqual(provider, null);
		});
	});
});
