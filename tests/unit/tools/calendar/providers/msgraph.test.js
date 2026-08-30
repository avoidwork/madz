/**
 * Tests for the MS Graph Calendar provider.
 * @see {@link src/tools/calendar/providers/msgraph.js}
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

describe("MsGraphProvider", () => {
	describe("constructor", () => {
		it("should initialize with valid credentials", async () => {
			let capturedAuthProvider = null;

			const mockClient = {
				init: (opts) => {
					capturedAuthProvider = opts.authProvider;
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			assert.ok(provider);
			assert.strictEqual(provider.type, "msgraph");
		});

		it("should set rate limit from config", async () => {
			let capturedAuthProvider = null;

			const mockClient = {
				init: (opts) => {
					capturedAuthProvider = opts.authProvider;
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
				rateLimit: { requestsPerMinute: 120 },
			});

			assert.strictEqual(provider.rateLimit, 120);
		});

		it("should not initialize when credentials are missing", async () => {
			const mockClient = {
				init: (opts) => {
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({});
			assert.ok(provider);
		});

		it("should not initialize when only tenantId is provided", async () => {
			const mockClient = {
				init: (opts) => {
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({ tenantId: "test-tenant" });
			assert.ok(provider);
		});

		it("should not initialize when only clientId is provided", async () => {
			const mockClient = {
				init: (opts) => {
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({ clientId: "test-client" });
			assert.ok(provider);
		});

		it("should not initialize when only clientSecret is provided", async () => {
			const mockClient = {
				init: (opts) => {
					return {
						api: () => ({
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						}),
					};
				},
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({ clientSecret: "test-secret" });
			assert.ok(provider);
		});
	});

	describe("validateCredentials", () => {
		it("should return valid when client is initialized", async () => {
			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, true);
		});

		it("should return invalid when credentials are missing", async () => {
			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({});
			const result = provider.validateCredentials();
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length > 0);
		});
	});

	describe("readEvents", () => {
		it("should read events for me", async () => {
			const mockEvent = {
				id: "evt123",
				subject: "Test Meeting",
				start: { dateTime: "2025-01-01T10:00:00Z" },
				end: { dateTime: "2025-01-01T11:00:00Z" },
				location: { displayName: "Conference Room A" },
				body: { content: "Test description" },
				attendees: [
					{ emailAddress: { address: "user@example.com" }, type: "required" },
				],
				organizer: { emailAddress: { address: "organizer@example.com" } },
				showAs: "busy",
			};

			const mockClient = {
				init: () => ({
					api: (path) => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [mockEvent] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

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
			assert.deepStrictEqual(result.events[0].attendees, [
				{ email: "user@example.com", type: "required" },
			]);
			assert.strictEqual(result.events[0].organizer, "organizer@example.com");
			assert.strictEqual(result.events[0].status, "busy");
		});

		it("should read events for delegated user", async () => {
			let capturedPath = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.readEvents({
				delegatedUser: "delegate@example.com",
				startDate: "2025-01-02T00:00:00Z",
				endDate: "2025-01-02T23:59:59Z",
			});

			assert.ok(capturedPath.includes("delegate@example.com"));
		});

		it("should use default maxResults of 50", async () => {
			let capturedQuery = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async (q) => {
							capturedQuery = q;
							return { value: [] };
						},
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.readEvents({
				startDate: "2025-01-03T00:00:00Z",
				endDate: "2025-01-03T23:59:59Z",
			});

			assert.strictEqual(capturedQuery.$top, 50);
			assert.strictEqual(capturedQuery.$orderby, "start/dateTime");
		});

		it("should use custom maxResults", async () => {
			let capturedQuery = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async (q) => {
							capturedQuery = q;
							return { value: [] };
						},
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.readEvents({
				startDate: "2025-01-04T00:00:00Z",
				endDate: "2025-01-04T23:59:59Z",
				maxResults: 100,
			});

			assert.strictEqual(capturedQuery.$top, 100);
		});

		it("should handle events with missing optional fields", async () => {
			const mockEvent = {
				id: "evt456",
				start: { dateTime: "2025-01-05T10:00:00Z" },
				end: { dateTime: "2025-01-05T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [mockEvent] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.readEvents({
				startDate: "2025-01-05T00:00:00Z",
				endDate: "2025-01-05T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events[0].title, "Untitled");
			assert.strictEqual(result.events[0].location, undefined);
			assert.strictEqual(result.events[0].description, undefined);
		});

		it("should handle empty events list", async () => {
			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.readEvents({
				startDate: "2025-01-06T00:00:00Z",
				endDate: "2025-01-06T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.events.length, 0);
		});
	});

	describe("createEvent", () => {
		it("should create an event for me", async () => {
			let capturedPath = null;
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async (event) => {
								capturedEvent = event;
								return { id: "newEvent123" };
							},
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.createEvent({
				title: "New Event",
				start: "2025-01-07T10:00:00Z",
				end: "2025-01-07T11:00:00Z",
				description: "Event description",
				location: "Location",
				timezone: "America/New_York",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.eventId, "newEvent123");
			assert.ok(capturedPath.includes("/events"));
			assert.strictEqual(capturedEvent.subject, "New Event");
			assert.strictEqual(capturedEvent.body.contentType, "HTML");
			assert.strictEqual(capturedEvent.body.content, "Event description");
			assert.strictEqual(capturedEvent.location.displayName, "Location");
			assert.strictEqual(capturedEvent.start.dateTime, "2025-01-07T10:00:00Z");
			assert.strictEqual(capturedEvent.start.timeZone, "America/New_York");
			assert.strictEqual(capturedEvent.end.dateTime, "2025-01-07T11:00:00Z");
			assert.strictEqual(capturedEvent.end.timeZone, "America/New_York");
		});

		it("should create event for delegated user", async () => {
			let capturedPath = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "newEvent456" }),
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				delegatedUser: "delegate@example.com",
				title: "Event",
				start: "2025-01-08T10:00:00Z",
				end: "2025-01-08T11:00:00Z",
			});

			assert.ok(capturedPath.includes("delegate@example.com"));
		});

		it("should create event with attendees", async () => {
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (event) => {
							capturedEvent = event;
							return { id: "newEvent789" };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				title: "Event with Attendees",
				start: "2025-01-09T10:00:00Z",
				end: "2025-01-09T11:00:00Z",
				attendees: ["user1@example.com", "user2@example.com"],
			});

			assert.deepStrictEqual(capturedEvent.attendees, [
				{ emailAddress: { address: "user1@example.com" }, type: "required" },
				{ emailAddress: { address: "user2@example.com" }, type: "required" },
			]);
		});

		it("should create event with reminders", async () => {
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (event) => {
							capturedEvent = event;
							return { id: "newEvent101" };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				title: "Event with Reminders",
				start: "2025-01-10T10:00:00Z",
				end: "2025-01-10T11:00:00Z",
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

		it("should create private event", async () => {
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (event) => {
							capturedEvent = event;
							return { id: "newEvent202" };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				title: "Private Event",
				start: "2025-01-11T10:00:00Z",
				end: "2025-01-11T11:00:00Z",
				visibility: "private",
			});

			assert.strictEqual(capturedEvent.showAs, "busy");
		});

		it("should create free event", async () => {
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (event) => {
							capturedEvent = event;
							return { id: "newEvent303" };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				title: "Free Event",
				start: "2025-01-12T10:00:00Z",
				end: "2025-01-12T11:00:00Z",
				visibility: "free",
			});

			assert.strictEqual(capturedEvent.showAs, "free");
		});

		it("should use default timezone of UTC", async () => {
			let capturedEvent = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (event) => {
							capturedEvent = event;
							return { id: "newEvent404" };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.createEvent({
				title: "Event",
				start: "2025-01-13T10:00:00Z",
				end: "2025-01-13T11:00:00Z",
			});

			assert.strictEqual(capturedEvent.start.timeZone, "UTC");
			assert.strictEqual(capturedEvent.end.timeZone, "UTC");
		});
	});

	describe("updateEvent", () => {
		it("should update an event", async () => {
			let capturedPath = null;
			let capturedUpdates = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async (updates) => {
								capturedUpdates = updates;
								return {};
							},
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.updateEvent({
				eventId: "evt123",
				title: "Updated Title",
				description: "Updated description",
				location: "Updated location",
				start: "2025-01-14T10:00:00Z",
				end: "2025-01-14T11:00:00Z",
				timezone: "America/New_York",
			});

			assert.strictEqual(result.ok, true);
			assert.ok(capturedPath.includes("/events/evt123"));
			assert.strictEqual(capturedUpdates.subject, "Updated Title");
			assert.deepStrictEqual(capturedUpdates.body, {
				contentType: "HTML",
				content: "Updated description",
			});
			assert.strictEqual(capturedUpdates.location.displayName, "Updated location");
			assert.strictEqual(capturedUpdates.start.dateTime, "2025-01-14T10:00:00Z");
			assert.strictEqual(capturedUpdates.start.timeZone, "America/New_York");
			assert.strictEqual(capturedUpdates.end.dateTime, "2025-01-14T11:00:00Z");
			assert.strictEqual(capturedUpdates.end.timeZone, "America/New_York");
		});

		it("should update event with attendees", async () => {
			let capturedUpdates = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async (updates) => {
							capturedUpdates = updates;
							return {};
						},
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.updateEvent({
				eventId: "evt123",
				attendees: ["newuser@example.com"],
			});

			assert.deepStrictEqual(capturedUpdates.attendees, [
				{ emailAddress: { address: "newuser@example.com" }, type: "required" },
			]);
		});

		it("should update event with reminders", async () => {
			let capturedUpdates = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async (updates) => {
							capturedUpdates = updates;
							return {};
						},
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.updateEvent({
				eventId: "evt123",
				reminders: [{ method: "email", minutes: 60 }],
			});

			assert.deepStrictEqual(capturedUpdates.reminders, {
				overrides: [{ method: "email", minutes: 60 }],
			});
		});

		it("should update event for delegated user", async () => {
			let capturedPath = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.updateEvent({
				delegatedUser: "delegate@example.com",
				eventId: "evt123",
				title: "Updated",
			});

			assert.ok(capturedPath.includes("delegate@example.com"));
		});
	});

	describe("deleteEvent", () => {
		it("should delete an event", async () => {
			let capturedPath = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.deleteEvent({ eventId: "evt123" });

			assert.strictEqual(result.ok, true);
			assert.ok(capturedPath.includes("/events/evt123"));
		});

		it("should delete event for delegated user", async () => {
			let capturedPath = null;

			const mockClient = {
				init: () => ({
					api: (path) => {
						capturedPath = path;
						return {
							query: async () => ({ value: [] }),
							get: async () => ({ value: [] }),
							post: async () => ({ id: "evt123", value: [] }),
							patch: async () => ({}),
							delete: async () => ({}),
						};
					},
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.deleteEvent({
				delegatedUser: "delegate@example.com",
				eventId: "evt123",
			});

			assert.ok(capturedPath.includes("delegate@example.com"));
		});
	});

	describe("findAvailability", () => {
		it("should find available time slots", async () => {
			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({
							id: "evt123",
							value: [
								{
									busyTimes: [
										{ start: { dateTime: "2025-01-15T10:00:00Z" }, end: { dateTime: "2025-01-15T11:00:00Z" } },
									],
								},
							],
						}),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.findAvailability({
				startDate: "2025-01-15T09:00:00Z",
				endDate: "2025-01-15T12:00:00Z",
				duration: 60,
			});

			assert.strictEqual(result.ok, true);
			assert.ok(result.slots);
		});

		it("should find availability for delegated user", async () => {
			let capturedPostBody = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (body) => {
							capturedPostBody = body;
							return { id: "evt123", value: [] };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.findAvailability({
				delegatedUser: "delegate@example.com",
				startDate: "2025-01-16T09:00:00Z",
				endDate: "2025-01-16T12:00:00Z",
				duration: 60,
			});

			assert.deepStrictEqual(capturedPostBody.schedules, [
				{ id: "delegate@example.com", name: "delegate@example.com" },
			]);
		});

		it("should use default timezone of UTC", async () => {
			let capturedPostBody = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (body) => {
							capturedPostBody = body;
							return { id: "evt123", value: [] };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.findAvailability({
				startDate: "2025-01-17T09:00:00Z",
				endDate: "2025-01-17T12:00:00Z",
				duration: 60,
			});

			assert.strictEqual(capturedPostBody.timeConstraint.timeZone, "UTC");
		});

		it("should use custom timezone", async () => {
			let capturedPostBody = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (body) => {
							capturedPostBody = body;
							return { id: "evt123", value: [] };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.findAvailability({
				startDate: "2025-01-18T09:00:00Z",
				endDate: "2025-01-18T12:00:00Z",
				duration: 60,
				timezone: "America/New_York",
			});

			assert.strictEqual(capturedPostBody.timeConstraint.timeZone, "America/New_York");
		});

		it("should use custom duration", async () => {
			let capturedPostBody = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async (body) => {
							capturedPostBody = body;
							return { id: "evt123", value: [] };
						},
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.findAvailability({
				startDate: "2025-01-19T09:00:00Z",
				endDate: "2025-01-19T12:00:00Z",
				duration: 120,
			});

			assert.strictEqual(capturedPostBody.requestedDuration, "PT120M");
		});
	});

	describe("generateSummary", () => {
		it("should generate summary for date range", async () => {
			const mockEvent = {
				id: "evt505",
				subject: "Summary Event",
				start: { dateTime: "2025-01-20T10:00:00Z" },
				end: { dateTime: "2025-01-20T11:00:00Z" },
				body: { content: "Summary description" },
				attendees: [{ emailAddress: { address: "user@example.com" } }],
				location: { displayName: "Summary location" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-20T00:00:00Z",
				endDate: "2025-01-20T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			assert.ok(result.summary);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 1);
			assert.strictEqual(summary[0].eventId, "evt505");
			assert.strictEqual(summary[0].title, "Summary Event");
			assert.strictEqual(summary[0].description, "Summary description");
			assert.deepStrictEqual(summary[0].attendees, ["user@example.com"]);
			assert.strictEqual(summary[0].location, "Summary location");
		});

		it("should generate summary for specific event", async () => {
			const mockEvent = {
				id: "evt606",
				subject: "Specific Event",
				start: { dateTime: "2025-01-21T10:00:00Z" },
				end: { dateTime: "2025-01-21T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				eventId: "evt606",
				startDate: "2025-01-21T00:00:00Z",
				endDate: "2025-01-21T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 1);
			assert.strictEqual(summary[0].eventId, "evt606");
		});

		it("should use default date range when not provided", async () => {
			let capturedQuery = null;

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async (q) => {
							capturedQuery = q;
							return { value: [] };
						},
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			await provider.generateSummary({});

			assert.ok(capturedQuery.startdatetime);
			assert.ok(capturedQuery.enddatetime);
			assert.strictEqual(capturedQuery.$top, 50);
			assert.strictEqual(capturedQuery.$orderby, "start/dateTime");
		});

		it("should handle empty events list", async () => {
			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [] }),
						get: async () => ({ value: [] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-22T00:00:00Z",
				endDate: "2025-01-22T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary.length, 0);
		});

		it("should handle events with missing optional fields", async () => {
			const mockEvent = {
				id: "evt707",
				start: { dateTime: "2025-01-23T10:00:00Z" },
				end: { dateTime: "2025-01-23T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-23T00:00:00Z",
				endDate: "2025-01-23T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary[0].title, "Untitled");
			assert.strictEqual(summary[0].description, undefined);
			assert.strictEqual(summary[0].attendees, undefined);
			assert.strictEqual(summary[0].location, undefined);
		});

		it("should handle events with missing attendees", async () => {
			const mockEvent = {
				id: "evt808",
				subject: "Event without Attendees",
				start: { dateTime: "2025-01-24T10:00:00Z" },
				end: { dateTime: "2025-01-24T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-24T00:00:00Z",
				endDate: "2025-01-24T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.deepStrictEqual(summary[0].attendees, []);
		});

		it("should handle events with missing location", async () => {
			const mockEvent = {
				id: "evt909",
				subject: "Event without Location",
				start: { dateTime: "2025-01-25T10:00:00Z" },
				end: { dateTime: "2025-01-25T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-25T00:00:00Z",
				endDate: "2025-01-25T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary[0].location, undefined);
		});

		it("should handle events with missing body", async () => {
			const mockEvent = {
				id: "evt1010",
				subject: "Event without Body",
				start: { dateTime: "2025-01-26T10:00:00Z" },
				end: { dateTime: "2025-01-26T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-26T00:00:00Z",
				endDate: "2025-01-26T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary[0].description, undefined);
		});

		it("should handle events with missing organizer", async () => {
			const mockEvent = {
				id: "evt1111",
				subject: "Event without Organizer",
				start: { dateTime: "2025-01-27T10:00:00Z" },
				end: { dateTime: "2025-01-27T11:00:00Z" },
			};

			const mockClient = {
				init: () => ({
					api: () => ({
						query: async () => ({ value: [mockEvent] }),
						get: async () => ({ value: [mockEvent] }),
						post: async () => ({ id: "evt123", value: [] }),
						patch: async () => ({}),
						delete: async () => ({}),
					}),
				}),
			};

			mock.module("@microsoft/microsoft-graph-client", () => ({
				Client: mockClient,
			}));

			const { MsGraphProvider } = await import(
				"../../src/tools/calendar/providers/msgraph.js"
			);

			const provider = new MsGraphProvider({
				tenantId: "test-tenant",
				clientId: "test-client",
				clientSecret: "test-secret",
			});

			const result = await provider.generateSummary({
				startDate: "2025-01-27T00:00:00Z",
				endDate: "2025-01-27T23:59:59Z",
			});

			assert.strictEqual(result.ok, true);
			const summary = JSON.parse(result.summary);
			assert.strictEqual(summary[0].organizer, undefined);
		});
	});
});
