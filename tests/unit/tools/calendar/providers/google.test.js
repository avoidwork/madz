/**
 * Tests for the Google Calendar provider.
 * @see {@link src/tools/calendar/providers/google.js}
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

describe("GoogleCalendarProvider", () => {
	describe("constructor with apiKey", () => {
		it("should initialize with apiKey config", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			assert.ok(provider);
			assert.strictEqual(provider.type, "google");
		});

		it("should set rate limit from config", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({
				apiKey: "test-key",
				rateLimit: { requestsPerMinute: 120 },
			});
			assert.strictEqual(provider.rateLimit, 120);
		});
	});

	describe("constructor with serviceAccountKey (JSON string)", () => {
		it("should parse JSON service account key", async () => {
			const serviceAccountKey = JSON.stringify({
				client_email: "test@project.iam.gserviceaccount.com",
				private_key: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
			});

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						auth: opts.auth,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ serviceAccountKey });
			assert.ok(provider);
		});

		it("should use serviceAccountEmail when provided", async () => {
			const serviceAccountKey = JSON.stringify({
				client_email: "default@project.iam.gserviceaccount.com",
				private_key: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
			});

			let capturedEmail = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							capturedEmail = opts.email;
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						auth: opts.auth,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({
				serviceAccountKey,
				serviceAccountEmail: "custom@example.com",
			});
			assert.strictEqual(capturedEmail, "custom@example.com");
		});

		it("should set quotaUser when impersonateEmail is provided", async () => {
			const serviceAccountKey = JSON.stringify({
				client_email: "test@project.iam.gserviceaccount.com",
				private_key: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
			});

			let capturedAuth = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							capturedAuth = this;
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						auth: opts.auth,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({
				serviceAccountKey,
				impersonateEmail: "impersonated@example.com",
			});
			assert.strictEqual(capturedAuth.quotaUser, "impersonated@example.com");
		});
	});

	describe("validateCredentials", () => {
		it("should return valid when calendar is initialized", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, true);
		});

		it("should return invalid when no credentials configured", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({});
			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length > 0);
		});
	});

	describe("readEvents", () => {
		it("should read events from primary calendar", async () => {
			const mockEvent = {
				id: "evt123",
				summary: "Test Meeting",
				start: { dateTime: "2025-01-01T10:00:00Z" },
				end: { dateTime: "2025-01-01T11:00:00Z" },
				location: "Conference Room A",
				description: "Test description",
				attendees: [{ email: "user@example.com" }],
				organizer: { email: "organizer@example.com" },
				status: "confirmed",
				visibility: "default",
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-01T00:00:00Z",
				endDate: "2025-01-01T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events.length, 1);
			assert.strictEqual(result.events[0].eventId, "evt123");
			assert.strictEqual(result.events[0].title, "Test Meeting");
			assert.strictEqual(result.events[0].start, "2025-01-01T10:00:00Z");
			assert.strictEqual(result.events[0].end, "2025-01-01T11:00:00Z");
			assert.strictEqual(result.events[0].location, "Conference Room A");
			assert.strictEqual(result.events[0].description, "Test description");
			assert.deepStrictEqual(result.events[0].attendees, ["user@example.com"]);
			assert.strictEqual(result.events[0].organizer, "organizer@example.com");
			assert.strictEqual(result.events[0].status, "confirmed");
			assert.strictEqual(result.events[0].visibility, "default");
		});

		it("should read events from specific calendar", async () => {
			const mockEvent = {
				id: "evt456",
				summary: "Another Meeting",
				start: { dateTime: "2025-01-02T14:00:00Z" },
				end: { dateTime: "2025-01-02T15:00:00Z" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				calendarId: "secondary",
				startDate: "2025-01-02T00:00:00Z",
				endDate: "2025-01-02T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events.length, 1);
		});

		it("should filter by attendee", async () => {
			const mockEvent = {
				id: "evt789",
				summary: "Team Meeting",
				start: { dateTime: "2025-01-03T09:00:00Z" },
				end: { dateTime: "2025-01-03T10:00:00Z" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-03T00:00:00Z",
				endDate: "2025-01-03T23:59:59Z",
				attendee: "team@example.com",
			});

			assert.strictEqual(result.ok, true);
		});

		it("should filter by keyword", async () => {
			const mockEvent = {
				id: "evt101",
				summary: "Project Review",
				start: { dateTime: "2025-01-04T11:00:00Z" },
				end: { dateTime: "2025-01-04T12:00:00Z" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-04T00:00:00Z",
				endDate: "2025-01-04T23:59:59Z",
				keyword: "project",
			});

			assert.strictEqual(result.ok, true);
		});

		it("should handle events with date instead of dateTime", async () => {
			const mockEvent = {
				id: "evt202",
				summary: "All Day Event",
				start: { date: "2025-01-05" },
				end: { date: "2025-01-06" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-05T00:00:00Z",
				endDate: "2025-01-05T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events[0].start, "2025-01-05");
		});

		it("should handle empty events list", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-06T00:00:00Z",
				endDate: "2025-01-06T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events.length, 0);
		});

		it("should handle missing optional fields", async () => {
			const mockEvent = {
				id: "evt303",
				start: { dateTime: "2025-01-07T10:00:00Z" },
				end: { dateTime: "2025-01-07T11:00:00Z" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.readEvents({
				startDate: "2025-01-07T00:00:00Z",
				endDate: "2025-01-07T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events[0].title, "Untitled");
			assert.strictEqual(result.events[0].location, undefined);
			assert.strictEqual(result.events[0].description, undefined);
		});

		it("should use default maxResults of 50", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async (params) => {
								capturedParams = params;
								return { data: { items: [] } };
							},
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.readEvents({
				startDate: "2025-01-08T00:00:00Z",
				endDate: "2025-01-08T23:59:59Z",
			});

			assert.strictEqual(capturedParams.maxResults, 50);
			assert.strictEqual(capturedParams.singleEvents, true);
			assert.strictEqual(capturedParams.orderBy, "startTime");
		});

		it("should use custom maxResults", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async (params) => {
								capturedParams = params;
								return { data: { items: [] } };
							},
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.readEvents({
				startDate: "2025-01-09T00:00:00Z",
				endDate: "2025-01-09T23:59:59Z",
				maxResults: 100,
			});

			assert.strictEqual(capturedParams.maxResults, 100);
		});
	});

	describe("createEvent", () => {
		it("should create an event", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "newEvent123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.createEvent({
				title: "New Event",
				start: "2025-01-10T10:00:00Z",
				end: "2025-01-10T11:00:00Z",
				description: "Event description",
				location: "Location",
				timezone: "America/New_York",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "newEvent123");
		});

		it("should create event with attendees", async () => {
			let capturedEvent = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedEvent = params.resource;
								return { data: { id: "newEvent456" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Event with Attendees",
				start: "2025-01-11T10:00:00Z",
				end: "2025-01-11T11:00:00Z",
				attendees: ["user1@example.com", "user2@example.com"],
			});

			assert.deepStrictEqual(capturedEvent.attendees, [
				{ email: "user1@example.com" },
				{ email: "user2@example.com" },
			]);
		});

		it("should create event with reminders", async () => {
			let capturedEvent = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedEvent = params.resource;
								return { data: { id: "newEvent789" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Event with Reminders",
				start: "2025-01-12T10:00:00Z",
				end: "2025-01-12T11:00:00Z",
				reminders: [
					{ method: "email", minutes: 30 },
					{ method: "popup", minutes: 10 },
				],
			});

			assert.deepStrictEqual(capturedEvent.reminders, {
				overrides: [
					{ method: "email", minutes: 30 },
					{ method: "popup", minutes: 10 },
				],
			});
		});

		it("should create event with visibility", async () => {
			let capturedEvent = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedEvent = params.resource;
								return { data: { id: "newEvent101" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Private Event",
				start: "2025-01-13T10:00:00Z",
				end: "2025-01-13T11:00:00Z",
				visibility: "private",
			});

			assert.strictEqual(capturedEvent.visibility, "private");
		});

		it("should use default calendarId of primary", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedParams = params;
								return { data: { id: "newEvent202" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Event",
				start: "2025-01-14T10:00:00Z",
				end: "2025-01-14T11:00:00Z",
			});

			assert.strictEqual(capturedParams.calendarId, "primary");
			assert.strictEqual(capturedParams.sendUpdates, "all");
		});

		it("should use custom calendarId", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedParams = params;
								return { data: { id: "newEvent303" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Event",
				start: "2025-01-15T10:00:00Z",
				end: "2025-01-15T11:00:00Z",
				calendarId: "custom",
			});

			assert.strictEqual(capturedParams.calendarId, "custom");
		});

		it("should use default timezone of UTC", async () => {
			let capturedEvent = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async (params) => {
								capturedEvent = params.resource;
								return { data: { id: "newEvent404" } };
							},
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.createEvent({
				title: "Event",
				start: "2025-01-16T10:00:00Z",
				end: "2025-01-16T11:00:00Z",
			});

			assert.strictEqual(capturedEvent.start.timeZone, "UTC");
			assert.strictEqual(capturedEvent.end.timeZone, "UTC");
		});
	});

	describe("updateEvent", () => {
		it("should update an event", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async (params) => {
								capturedParams = params;
								return {};
							},
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.updateEvent({
				eventId: "evt123",
				title: "Updated Title",
				description: "Updated description",
				location: "Updated location",
				start: "2025-01-17T10:00:00Z",
				end: "2025-01-17T11:00:00Z",
				visibility: "private",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(capturedParams.eventId, "evt123");
			assert.strictEqual(capturedParams.calendarId, "primary");
			assert.strictEqual(capturedParams.sendUpdates, "all");
			assert.strictEqual(capturedParams.resource.summary, "Updated Title");
			assert.strictEqual(capturedParams.resource.description, "Updated description");
			assert.strictEqual(capturedParams.resource.location, "Updated location");
			assert.strictEqual(capturedParams.resource.visibility, "private");
		});

		it("should update event with attendees", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async (params) => {
								capturedParams = params;
								return {};
							},
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.updateEvent({
				eventId: "evt123",
				attendees: ["newuser@example.com"],
			});

			assert.deepStrictEqual(capturedParams.resource.attendees, [
				{ email: "newuser@example.com" },
			]);
		});

		it("should update event with reminders", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async (params) => {
								capturedParams = params;
								return {};
							},
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.updateEvent({
				eventId: "evt123",
				reminders: [{ method: "email", minutes: 60 }],
			});

			assert.deepStrictEqual(capturedParams.resource.reminders, {
				overrides: [{ method: "email", minutes: 60 }],
			});
		});

		it("should use custom calendarId", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async (params) => {
								capturedParams = params;
								return {};
							},
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.updateEvent({
				calendarId: "custom",
				eventId: "evt123",
				title: "Updated",
			});

			assert.strictEqual(capturedParams.calendarId, "custom");
		});
	});

	describe("deleteEvent", () => {
		it("should delete an event", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async (params) => {
								capturedParams = params;
								return {};
							},
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.deleteEvent({ eventId: "evt123" });

			assert.strictEqual(result.ok, true);
			assert.strictEqual(capturedParams.eventId, "evt123");
			assert.strictEqual(capturedParams.calendarId, "primary");
		});

		it("should delete event with custom calendarId", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async (params) => {
								capturedParams = params;
								return {};
							},
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.deleteEvent({ calendarId: "custom", eventId: "evt123" });

			assert.strictEqual(capturedParams.calendarId, "custom");
		});
	});

	describe("findAvailability", () => {
		it("should find available time slots", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({
								data: {
									calendars: {
										primary: {
											busy: [
												{ start: "2025-01-20T10:00:00Z", end: "2025-01-20T11:00:00Z" },
											],
										},
									},
								},
							}),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.findAvailability({
				startDate: "2025-01-20T09:00:00Z",
				endDate: "2025-01-20T12:00:00Z",
				duration: 60,
			});

			assert.strictEqual(result.ok, true);
			assert.ok(result.slots);
		});

		it("should use default calendarId of primary", async () => {
			let capturedResource = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async (params) => {
								capturedResource = params.resource;
								return { data: { calendars: {} } };
							},
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.findAvailability({
				startDate: "2025-01-21T09:00:00Z",
				endDate: "2025-01-21T12:00:00Z",
				duration: 60,
			});

			assert.deepStrictEqual(capturedResource.items, [{ id: "primary" }]);
		});

		it("should use custom calendarId", async () => {
			let capturedResource = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async (params) => {
								capturedResource = params.resource;
								return { data: { calendars: {} } };
							},
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.findAvailability({
				calendarId: "custom",
				startDate: "2025-01-22T09:00:00Z",
				endDate: "2025-01-22T12:00:00Z",
				duration: 60,
			});

			assert.deepStrictEqual(capturedResource.items, [{ id: "custom" }]);
		});

		it("should use default timezone of UTC", async () => {
			let capturedResource = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async (params) => {
								capturedResource = params.resource;
								return { data: { calendars: {} } };
							},
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.findAvailability({
				startDate: "2025-01-23T09:00:00Z",
				endDate: "2025-01-23T12:00:00Z",
				duration: 60,
			});

			assert.strictEqual(capturedResource.timeSlots.timeZone, "UTC");
		});
	});

	describe("generateSummary", () => {
		it("should generate summary for date range", async () => {
			const mockEvent = {
				id: "evt505",
				summary: "Summary Event",
				start: { dateTime: "2025-01-24T10:00:00Z" },
				end: { dateTime: "2025-01-24T11:00:00Z" },
				description: "Summary description",
				attendees: [{ email: "user@example.com" }],
				location: "Summary location",
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.generateSummary({
				startDate: "2025-01-24T00:00:00Z",
				endDate: "2025-01-24T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.ok(result.summary);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 1);
			assert.strictEqual(summary[0].eventId, "evt505");
			assert.strictEqual(summary[0].title, "Summary Event");
		});

		it("should generate summary for specific event", async () => {
			const mockEvent = {
				id: "evt606",
				summary: "Specific Event",
				start: { dateTime: "2025-01-25T10:00:00Z" },
				end: { dateTime: "2025-01-25T11:00:00Z" },
			};

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [mockEvent] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.generateSummary({
				eventId: "evt606",
				startDate: "2025-01-25T00:00:00Z",
				endDate: "2025-01-25T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 1);
			assert.strictEqual(summary[0].eventId, "evt606");
		});

		it("should use default date range when not provided", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async (params) => {
								capturedParams = params;
								return { data: { items: [] } };
							},
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.generateSummary({});

			assert.ok(capturedParams.timeMin);
			assert.ok(capturedParams.timeMax);
			assert.strictEqual(capturedParams.maxResults, 50);
			assert.strictEqual(capturedParams.singleEvents, true);
			assert.strictEqual(capturedParams.orderBy, "startTime");
		});

		it("should use custom calendarId", async () => {
			let capturedParams = null;

			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async (params) => {
								capturedParams = params;
								return { data: { items: [] } };
							},
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			await provider.generateSummary({
				calendarId: "custom",
				startDate: "2025-01-26T00:00:00Z",
				endDate: "2025-01-26T23:59:59Z",
			});

			assert.strictEqual(capturedParams.calendarId, "custom");
		});

		it("should handle empty events list", async () => {
			const mockGoogle = {
				auth: {
					JWT: class {
						constructor(opts) {
							this.email = opts.email;
							this.key = opts.key;
							this.scope = opts.scope;
						}
					},
				},
				calendar: function (opts) {
					return {
						version: opts.version,
						apiKey: opts.apiKey,
						events: {
							list: async () => ({ data: { items: [] } }),
							insert: async () => ({ data: { id: "evt123" } }),
							update: async () => ({}),
							delete: async () => ({}),
						},
						freebusy: {
							query: async () => ({ data: { calendars: {} } }),
						},
					};
				},
			};

			mock.module("googleapis", () => mockGoogle);

			const { GoogleCalendarProvider } = await import(
				"../../src/tools/calendar/providers/google.js"
			);

			const provider = new GoogleCalendarProvider({ apiKey: "test-key" });
			const result = await provider.generateSummary({
				startDate: "2025-01-27T00:00:00Z",
				endDate: "2025-01-27T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 0);
		});
	});
});
